// Beat / onset detection (Phase 4.3). An energy-novelty detector: frame the
// signal, take the positive energy difference (novelty), and peak-pick against
// an adaptive threshold with a minimum inter-onset gap. Good enough for
// snap-to-beat on percussive/music content, and fully client-side.

export interface BeatDetectOptions {
  frame?: number
  hop?: number
  /** Threshold = local mean novelty × this factor. */
  sensitivity?: number
  /** Minimum seconds between detected beats. */
  minGap?: number
}

/** Detect onset times (seconds) from mono PCM samples. Pure + deterministic. */
export function detectBeatsFromSamples(
  data: Float32Array | number[],
  sampleRate: number,
  opts: BeatDetectOptions = {},
): number[] {
  const frame = opts.frame ?? 1024
  const hop = opts.hop ?? 512
  const sensitivity = opts.sensitivity ?? 1.5
  const minGap = opts.minGap ?? 0.12
  if (data.length < frame || sampleRate <= 0) return []

  // Short-time energy per frame.
  const energies: number[] = []
  for (let i = 0; i + frame <= data.length; i += hop) {
    let e = 0
    for (let j = 0; j < frame; j++) {
      const v = data[i + j] || 0
      e += v * v
    }
    energies.push(e / frame)
  }

  // Novelty = positive energy increase.
  const novelty = energies.map((e, i) => (i > 0 ? Math.max(0, e - energies[i - 1]) : 0))

  const W = 16 // half-window (frames) for the adaptive threshold
  const minGapFrames = Math.max(1, Math.ceil((sampleRate * minGap) / hop))
  const beats: number[] = []
  let last = -minGapFrames
  for (let i = 1; i < novelty.length - 1; i++) {
    let sum = 0
    let c = 0
    for (let k = i - W; k <= i + W; k++) {
      if (k >= 0 && k < novelty.length) {
        sum += novelty[k]
        c++
      }
    }
    const thresh = (sum / c) * sensitivity + 1e-9
    const isPeak = novelty[i] > thresh && novelty[i] >= novelty[i - 1] && novelty[i] >= novelty[i + 1]
    if (isPeak && i - last >= minGapFrames) {
      beats.push((i * hop) / sampleRate)
      last = i
    }
  }
  return beats
}

const beatCache = new Map<string, number[]>()

/** Decode an audio blob and detect beats (cached per media id). Returns source-time seconds. */
export async function getBeats(id: string, blob: Blob, opts?: BeatDetectOptions): Promise<number[]> {
  const hit = beatCache.get(id)
  if (hit) return hit
  const AudioCtor: typeof AudioContext =
    window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
  const ctx = new AudioCtor()
  try {
    const buffer = await ctx.decodeAudioData(await blob.arrayBuffer())
    const beats = detectBeatsFromSamples(buffer.getChannelData(0), buffer.sampleRate, opts)
    beatCache.set(id, beats)
    return beats
  } finally {
    void ctx.close()
  }
}
