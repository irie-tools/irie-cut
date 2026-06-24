// Post-kit (Tier 3). After export, assemble the rest of a social post: a caption
// + hashtags (inherited from the Pam campaign — no regeneration) and a poster
// frame grabbed from the live preview. Thin, dependency-free, no external API.

import type { Project } from '#/types/editor'

function normTag(s: string): string {
  return s.replace(/[^a-z0-9]/gi, '')
}

/** Hashtags from the promo title/artist + a curated music-promo set. */
export function buildHashtags(project: Project): string[] {
  const tags = new Set<string>()
  const add = (raw: string) => {
    const t = normTag(raw)
    if (t.length > 1) tags.add(`#${t}`)
  }
  if (project.promo?.title) add(project.promo.title)
  if (project.promo?.artist) add(project.promo.artist)
  for (const t of ['newmusic', 'nowplaying', 'newsingle', 'musicvideo', 'indie']) add(t)
  return [...tags].slice(0, 12)
}

/** Caption text = the campaign's caption/hook (from Pam) + hashtags. */
export function buildCaptionText(project: Project): string {
  const c = project.promo?.campaign
  const main =
    c?.captionDraft?.trim() ||
    c?.hook?.trim() ||
    (project.promo?.title ? `New: ${project.promo.title}` : project.name)
  return [main, '', buildHashtags(project).join(' ')].join('\n')
}

/** Grab the live preview canvas as a poster JPEG blob (the current frame). */
export async function buildPosterFromCanvas(canvas: HTMLCanvasElement | null): Promise<Blob | null> {
  if (!canvas) return null
  return new Promise((resolve) => {
    canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.92)
  })
}
