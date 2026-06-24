// Audio spectrum analysis for the on-frame "sound bar" visualizer. Decodes the
// song once, runs a short-time FFT into log-spaced frequency bands per frame,
// and caches the result by media id. The shared renderer reads it synchronously
// so the bars react identically in the preview and the export. No AI.

import type { Project } from '#/types/editor'

export interface Spectrum {
  /** Frames per second of analysis. */
  fps: number
  bands: number
  frameCount: number
  /** frameCount × bands, row-major, normalized 0..1. data[frame*bands + b]. */
  data: Float32Array
}

const cache = new Map<string, Spectrum>()

/** Cached spectrum for a media id, or null if not analysed yet. */
export function getSpectrum(id: string): Spectrum | null {
  return cache.get(id) ?? null
}

/** In-place iterative radix-2 Cooley–Tukey FFT (n must be a power of two). */
function fft(re: Float32Array, im: Float32Array): void {
  const n = re.length
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1
    for (; j & bit; bit >>= 1) j ^= bit
    j ^= bit
    if (i < j) {
      const tr = re[i]; re[i] = re[j]; re[j] = tr
      const ti = im[i]; im[i] = im[j]; im[j] = ti
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len
    const wr = Math.cos(ang)
    const wi = Math.sin(ang)
    for (let i = 0; i < n; i += len) {
      let cwr = 1
      let cwi = 0
      for (let k = 0; k < len >> 1; k++) {
        const a = i + k
        const b = a + (len >> 1)
        const vr = re[b] * cwr - im[b] * cwi
        const vi = re[b] * cwi + im[b] * cwr
        re[b] = re[a] - vr
        im[b] = im[a] - vi
        re[a] += vr
        im[a] += vi
        const nwr = cwr * wr - cwi * wi
        cwi = cwr * wi + cwi * wr
        cwr = nwr
      }
    }
  }
}

/** Log-spaced FFT-bin boundaries for the bands (low → high frequency). */
function bandEdges(bands: number, fftSize: number, sr: number): number[] {
  const minHz = 40
  const maxHz = Math.min(15000, sr / 2)
  const edges: number[] = []
  for (let b = 0; b <= bands; b++) {
    const hz = minHz * Math.pow(maxHz / minHz, b / bands)
    edges.push(Math.min(fftSize >> 1, Math.max(1, Math.round((hz * fftSize) / sr))))
  }
  return edges
}

/**
 * Analyse an audio blob into a per-frame frequency-band spectrum and cache it.
 * Cheap and one-time; safe to call repeatedly (returns the cache on a hit).
 */
export async function computeSpectrum(
  id: string,
  blob: Blob,
  opts: { fps?: number; bands?: number } = {},
): Promise<Spectrum> {
  const hit = cache.get(id)
  if (hit) return hit

  const AudioCtor: typeof AudioContext =
    window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
  const audioCtx = new AudioCtor()
  let buffer: AudioBuffer
  try {
    buffer = await audioCtx.decodeAudioData(await blob.arrayBuffer())
  } finally {
    void audioCtx.close()
  }

  const ch = buffer.getChannelData(0)
  const sr = buffer.sampleRate
  const fps = opts.fps ?? 30
  const bands = opts.bands ?? 56
  const fftSize = 2048
  const hop = Math.max(1, Math.floor(sr / fps))
  const frameCount = Math.max(1, Math.floor((ch.length - fftSize) / hop) + 1)
  const data = new Float32Array(frameCount * bands)

  const win = new Float32Array(fftSize)
  for (let i = 0; i < fftSize; i++) win[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (fftSize - 1))
  const edges = bandEdges(bands, fftSize, sr)
  const re = new Float32Array(fftSize)
  const im = new Float32Array(fftSize)

  let max = 1e-6
  for (let f = 0; f < frameCount; f++) {
    const start = f * hop
    for (let i = 0; i < fftSize; i++) {
      re[i] = (ch[start + i] || 0) * win[i]
      im[i] = 0
    }
    fft(re, im)
    for (let b = 0; b < bands; b++) {
      let sum = 0
      let cnt = 0
      for (let bin = edges[b]; bin < edges[b + 1]; bin++) {
        sum += Math.hypot(re[bin], im[bin])
        cnt++
      }
      const v = cnt ? sum / cnt : 0
      data[f * bands + b] = v
      if (v > max) max = v
    }
  }

  // Normalize to 0..1 with a gamma lift so quiet detail still moves.
  for (let i = 0; i < data.length; i++) data[i] = Math.pow(Math.min(1, data[i] / max), 0.6)

  const spec: Spectrum = { fps, bands, frameCount, data }
  cache.set(id, spec)
  return spec
}

/** Make sure the song's spectrum is cached before an export renders frames. */
export async function ensureSpectrumForExport(
  project: Project,
  getBlob: (mediaId: string) => Promise<Blob | undefined>,
): Promise<void> {
  if (!project.visualizer?.enabled) return
  const song = project.tracks.flatMap((t) => t.clips).find((c) => c.type === 'audio' && c.mediaId)
  if (!song?.mediaId || getSpectrum(song.mediaId)) return
  const blob = await getBlob(song.mediaId)
  if (!blob) return
  try {
    await computeSpectrum(song.mediaId, blob)
  } catch {
    /* visualizer just won't render — non-fatal */
  }
}
