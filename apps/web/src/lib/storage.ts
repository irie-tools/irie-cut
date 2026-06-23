// IndexedDB persistence for projects, media metadata and the raw media blobs.
// All access is lazy and client-only so this module is safe to import during SSR.

import type { MediaAsset, Project } from '#/types/editor'

const DB_NAME = 'irie-cut'
const DB_VERSION = 1
const STORE_PROJECTS = 'projects'
const STORE_MEDIA = 'media'
const STORE_BLOBS = 'blobs'

let dbPromise: Promise<IDBDatabase> | null = null

function openDB(): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined') {
    return Promise.reject(new Error('IndexedDB is not available in this environment'))
  }
  if (dbPromise) return dbPromise

  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE_PROJECTS)) {
        db.createObjectStore(STORE_PROJECTS, { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains(STORE_MEDIA)) {
        const media = db.createObjectStore(STORE_MEDIA, { keyPath: 'id' })
        media.createIndex('projectId', 'projectId', { unique: false })
      }
      if (!db.objectStoreNames.contains(STORE_BLOBS)) {
        db.createObjectStore(STORE_BLOBS, { keyPath: 'id' })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
  return dbPromise
}

function tx<T>(
  store: string,
  mode: IDBTransactionMode,
  run: (s: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return openDB().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const transaction = db.transaction(store, mode)
        const req = run(transaction.objectStore(store))
        req.onsuccess = () => resolve(req.result)
        req.onerror = () => reject(req.error)
      }),
  )
}

// ---- Projects ----

export async function getAllProjects(): Promise<Project[]> {
  const all = await tx<Project[]>(STORE_PROJECTS, 'readonly', (s) => s.getAll())
  return all.sort((a, b) => b.updatedAt - a.updatedAt)
}

export function getProject(id: string): Promise<Project | undefined> {
  return tx<Project | undefined>(STORE_PROJECTS, 'readonly', (s) => s.get(id))
}

export function saveProject(project: Project): Promise<IDBValidKey> {
  return tx(STORE_PROJECTS, 'readwrite', (s) => s.put(project))
}

export async function deleteProject(id: string): Promise<void> {
  const media = await getProjectMedia(id)
  await Promise.all(media.map((m) => deleteMedia(m.id)))
  await tx(STORE_PROJECTS, 'readwrite', (s) => s.delete(id))
}

// ---- Media ----

export function getProjectMedia(projectId: string): Promise<MediaAsset[]> {
  return tx<MediaAsset[]>(STORE_MEDIA, 'readonly', (s) =>
    s.index('projectId').getAll(projectId),
  )
}

export async function saveMedia(asset: MediaAsset, blob: Blob): Promise<void> {
  await tx(STORE_BLOBS, 'readwrite', (s) => s.put({ id: asset.id, blob }))
  await tx(STORE_MEDIA, 'readwrite', (s) => s.put(asset))
}

export async function getMediaBlob(id: string): Promise<Blob | undefined> {
  const row = await tx<{ id: string; blob: Blob } | undefined>(
    STORE_BLOBS,
    'readonly',
    (s) => s.get(id),
  )
  return row?.blob
}

export async function deleteMedia(id: string): Promise<void> {
  await tx(STORE_MEDIA, 'readwrite', (s) => s.delete(id))
  await tx(STORE_BLOBS, 'readwrite', (s) => s.delete(id))
}
