// Decodes an audio blob into normalized peak buckets for waveform display.
// Results are cached per media id (decoding is relatively expensive) and shared
// across all clips that reference the same source.

const cache = new Map<string, number[]>()
const pending = new Map<string, Promise<number[]>>()

export function cachedWaveform(id: string): number[] | undefined {
  return cache.get(id)
}

export function getWaveform(id: string, blob: Blob, buckets = 240): Promise<number[]> {
  const hit = cache.get(id)
  if (hit) return Promise.resolve(hit)
  const inflight = pending.get(id)
  if (inflight) return inflight

  const job = (async () => {
    const AudioCtor: typeof AudioContext =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    const ctx = new AudioCtor()
    try {
      const buffer = await ctx.decodeAudioData(await blob.arrayBuffer())
      const data = buffer.getChannelData(0)
      const block = Math.max(1, Math.floor(data.length / buckets))
      const peaks: number[] = []
      for (let i = 0; i < buckets; i++) {
        let max = 0
        const start = i * block
        for (let j = 0; j < block; j++) {
          const v = Math.abs(data[start + j] || 0)
          if (v > max) max = v
        }
        peaks.push(max)
      }
      const norm = Math.max(0.01, ...peaks)
      const result = peaks.map((p) => p / norm)
      cache.set(id, result)
      return result
    } finally {
      void ctx.close()
    }
  })()

  pending.set(id, job)
  job.finally(() => pending.delete(id))
  return job
}
