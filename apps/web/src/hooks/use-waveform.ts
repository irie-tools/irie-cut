import { useEffect, useState } from 'react'
import { getMediaBlob } from '#/lib/storage'
import { getWaveform, cachedWaveform } from '#/lib/waveform'

/** Returns normalized peak buckets for an audio source, decoding lazily once. */
export function useWaveform(mediaId: string | undefined): number[] | null {
  const [peaks, setPeaks] = useState<number[] | null>(() =>
    mediaId ? (cachedWaveform(mediaId) ?? null) : null,
  )

  useEffect(() => {
    if (!mediaId) return
    const cached = cachedWaveform(mediaId)
    if (cached) {
      setPeaks(cached)
      return
    }
    let alive = true
    void (async () => {
      try {
        const blob = await getMediaBlob(mediaId)
        if (!blob) return
        const result = await getWaveform(mediaId, blob)
        if (alive) setPeaks(result)
      } catch {
        /* unsupported/undecodable audio — skip the waveform */
      }
    })()
    return () => {
      alive = false
    }
  }, [mediaId])

  return peaks
}
