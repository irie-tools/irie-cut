// One-click multi-platform export (Tier 1.3). Re-frames one timeline to each
// selected aspect (cover-fill, respecting explicit per-clip fit) and runs the
// frame-accurate WebCodecs export for each — so a promo goes to every platform
// size from a single source. Reuses exporter-webcodecs; no new render path.

import type { Project } from '#/types/editor'
import { exportProjectWebCodecs } from '#/lib/exporter-webcodecs'

export interface SizePreset {
  id: string
  label: string
  w: number
  h: number
}

export const PLATFORM_SIZES: SizePreset[] = [
  { id: '9x16', label: 'Reels · TikTok · Shorts (9:16)', w: 1080, h: 1920 },
  { id: '1x1', label: 'Feed (1:1)', w: 1080, h: 1080 },
  { id: '16x9', label: 'YouTube (16:9)', w: 1920, h: 1080 },
  { id: '4x5', label: 'Portrait (4:5)', w: 1080, h: 1350 },
]

/** A reframed copy of the project at `w x h` (cover-fills clips; respects explicit fit). */
export function reframedProject(p: Project, w: number, h: number): Project {
  if (p.width === w && p.height === h) return p
  return {
    ...p,
    width: w,
    height: h,
    tracks: p.tracks.map((t) => ({
      ...t,
      clips: t.clips.map((c) =>
        c.type === 'video' || c.type === 'image' ? { ...c, fit: c.fit ?? 'cover' } : c,
      ),
    })),
  }
}

export interface MultiExportItem {
  blob: Blob
  extension: string
  size: SizePreset
}

/** Export `sizes` from one project, sequentially. `onProgress(fraction, size)` spans all sizes. */
export async function exportAllSizes(
  project: Project,
  getUrl: (mediaId: string) => string | undefined,
  getBlob: (mediaId: string) => Promise<Blob | undefined>,
  sizes: SizePreset[],
  onProgress: (fraction: number, size: SizePreset) => void,
): Promise<MultiExportItem[]> {
  const out: MultiExportItem[] = []
  for (let i = 0; i < sizes.length; i++) {
    const s = sizes[i]
    const proj = reframedProject(project, s.w, s.h)
    const { blob, extension } = await exportProjectWebCodecs(
      proj,
      getUrl,
      getBlob,
      (f) => onProgress((i + f) / sizes.length, s),
      {},
    )
    out.push({ blob, extension, size: s })
  }
  return out
}
