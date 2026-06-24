// Project portability (Phase 5.3): export a project + all its media into a
// single self-contained JSON bundle, and import one back (re-keyed) so projects
// move between browsers/machines. Media blobs travel as data URLs.

import type { Project, MediaAsset } from '#/types/editor'
import * as storage from '#/lib/storage'

interface Bundle {
  irieCut: 1
  exportedAt: number
  project: Project
  media: { asset: MediaAsset; data: string }[]
}

function uid(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader()
    fr.onload = () => resolve(fr.result as string)
    fr.onerror = () => reject(fr.error)
    fr.readAsDataURL(blob)
  })
}

async function dataUrlToBlob(url: string): Promise<Blob> {
  return (await fetch(url)).blob()
}

/** Build a downloadable .json bundle of a project plus its media. */
export async function exportProjectBundle(projectId: string): Promise<{ blob: Blob; name: string }> {
  const project = await storage.getProject(projectId)
  if (!project) throw new Error('Project not found.')
  const media = await storage.getProjectMedia(projectId)
  const mediaOut = await Promise.all(
    media.map(async (asset) => {
      const blob = await storage.getMediaBlob(asset.id)
      return { asset, data: blob ? await blobToDataUrl(blob) : '' }
    }),
  )
  const bundle: Bundle = { irieCut: 1, exportedAt: Date.now(), project, media: mediaOut }
  return { blob: new Blob([JSON.stringify(bundle)], { type: 'application/json' }), name: project.name }
}

/** Import a bundle file, re-keying ids so it never clobbers an existing project. Returns the new id. */
export async function importProjectBundle(file: File): Promise<string> {
  const bundle = JSON.parse(await file.text()) as Bundle
  if (!bundle || !bundle.project || !Array.isArray(bundle.media ?? [])) {
    throw new Error('Not a valid Irie Cut project file.')
  }
  const now = Date.now()
  const newProjectId = uid()
  const idMap = new Map<string, string>()

  const newMedia = (bundle.media ?? []).map((m) => {
    const newId = uid()
    idMap.set(m.asset.id, newId)
    return { ...m, asset: { ...m.asset, id: newId, projectId: newProjectId } }
  })

  const project: Project = {
    ...bundle.project,
    id: newProjectId,
    name: `${bundle.project.name} (imported)`,
    createdAt: now,
    updatedAt: now,
    tracks: bundle.project.tracks.map((t) => ({
      ...t,
      clips: t.clips.map((c) =>
        c.mediaId && idMap.has(c.mediaId) ? { ...c, mediaId: idMap.get(c.mediaId) } : c,
      ),
    })),
  }

  await storage.saveProject(project)
  for (const m of newMedia) {
    if (!m.data) continue
    const blob = await dataUrlToBlob(m.data)
    await storage.saveMedia(m.asset, blob)
  }
  return newProjectId
}
