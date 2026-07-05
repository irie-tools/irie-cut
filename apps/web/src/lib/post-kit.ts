// Post-kit (Tier 3). After export, assemble the rest of a social post: a caption
// + hashtags, and a poster frame grabbed from the live preview. Thin,
// dependency-free, no external API.

import type { Project } from '#/types/editor'

function normTag(s: string): string {
  return s.replace(/[^a-z0-9]/gi, '')
}

/** Hashtags from the project name + a curated set. */
export function buildHashtags(project: Project): string[] {
  const tags = new Set<string>()
  const add = (raw: string) => {
    const t = normTag(raw)
    if (t.length > 1) tags.add(`#${t}`)
  }
  add(project.name)
  for (const t of ['newvideo', 'nowplaying', 'videoedit', 'contentcreator', 'indie']) add(t)
  return [...tags].slice(0, 12)
}

/** Caption text = the project name + hashtags. */
export function buildCaptionText(project: Project): string {
  const main = `New: ${project.name}`
  return [main, '', buildHashtags(project).join(' ')].join('\n')
}

/** Grab the live preview canvas as a poster JPEG blob (the current frame). */
export async function buildPosterFromCanvas(canvas: HTMLCanvasElement | null): Promise<Blob | null> {
  if (!canvas) return null
  return new Promise((resolve) => {
    canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.92)
  })
}
