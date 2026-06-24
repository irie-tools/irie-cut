// Prepare audio for transcription. Vercel serverless caps request bodies at
// ~4.5MB, but a full song's audio is far bigger — so we downsample to 16kHz mono
// (all Whisper needs) and slice it into chunks that fit, each tagged with its
// time offset so the caller can merge the results back onto one timeline.

export interface WavChunk {
  wav: Blob
  /** Seconds this chunk starts at in the original audio. */
  offset: number
}

/** Decode any audio blob → mono 16kHz PCM samples. */
async function decodeMono16k(blob: Blob): Promise<{ samples: Float32Array; sampleRate: number }> {
  const AudioCtor: typeof AudioContext =
    window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
  const ctx = new AudioCtor()
  let decoded: AudioBuffer
  try {
    decoded = await ctx.decodeAudioData(await blob.arrayBuffer())
  } finally {
    void ctx.close()
  }
  const target = 16000
  const frames = Math.max(1, Math.ceil(decoded.duration * target))
  // OfflineAudioContext resamples to `target` and downmixes to mono on render.
  const off = new OfflineAudioContext(1, frames, target)
  const src = off.createBufferSource()
  src.buffer = decoded
  src.connect(off.destination)
  src.start()
  const rendered = await off.startRendering()
  return { samples: rendered.getChannelData(0), sampleRate: target }
}

/** Encode mono Float32 PCM → a 16-bit WAV blob. */
function encodeWav(samples: Float32Array, sampleRate: number): Blob {
  const buffer = new ArrayBuffer(44 + samples.length * 2)
  const view = new DataView(buffer)
  const writeStr = (offset: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i))
  }
  writeStr(0, 'RIFF')
  view.setUint32(4, 36 + samples.length * 2, true)
  writeStr(8, 'WAVE')
  writeStr(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true) // PCM
  view.setUint16(22, 1, true) // mono
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * 2, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  writeStr(36, 'data')
  view.setUint32(40, samples.length * 2, true)
  let o = 44
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]))
    view.setInt16(o, s < 0 ? s * 0x8000 : s * 0x7fff, true)
    o += 2
  }
  return new Blob([buffer], { type: 'audio/wav' })
}

/**
 * Decode → 16kHz mono → WAV chunks of at most `maxSec` seconds each (default 75s
 * ≈ 2.4MB ≈ 3.2MB base64, safely under Vercel's ~4.5MB request limit). Returns
 * one chunk for short audio, several for a full song.
 */
export async function audioToWavChunks(blob: Blob, maxSec = 75): Promise<WavChunk[]> {
  const { samples, sampleRate } = await decodeMono16k(blob)
  const chunkLen = Math.max(sampleRate, Math.floor(maxSec * sampleRate))
  const chunks: WavChunk[] = []
  for (let start = 0; start < samples.length; start += chunkLen) {
    const slice = samples.subarray(start, Math.min(samples.length, start + chunkLen))
    chunks.push({ wav: encodeWav(slice, sampleRate), offset: start / sampleRate })
  }
  return chunks.length ? chunks : [{ wav: encodeWav(samples, sampleRate), offset: 0 }]
}
