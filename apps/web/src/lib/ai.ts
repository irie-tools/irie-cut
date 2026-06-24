// Client helpers for the AI serverless functions (/api/ai-*). These return
// friendly errors when AI isn't configured (no key) so the UI can degrade.

import { audioToWavChunks } from '#/lib/audio-prep'

export interface Cue {
  start: number
  end: number
  text: string
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  let res: Response
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  } catch {
    throw new Error('AI endpoint unreachable. AI runs on the deployed site (or `vercel dev`).')
  }
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error((data as { error?: string }).error || 'AI request failed.')
  return data as T
}

export function generateCopy(prompt: string, kind: string): Promise<{ variants: string[] }> {
  return postJson('/api/ai-copy', { prompt, kind })
}

export function generateImage(prompt: string, size?: string): Promise<{ dataUrl: string }> {
  return postJson('/api/ai-image', { prompt, size })
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = String(reader.result)
      resolve(result.slice(result.indexOf(',') + 1))
    }
    reader.onerror = () => reject(new Error('Failed to read audio'))
    reader.readAsDataURL(blob)
  })
}

export async function transcribe(blob: Blob): Promise<{ cues: Cue[]; words: Cue[] }> {
  // Shrink + chunk so each request fits Vercel's ~4.5MB body limit, then merge
  // the per-chunk results back onto one timeline using each chunk's offset.
  const chunks = await audioToWavChunks(blob)
  const cues: Cue[] = []
  const words: Cue[] = []
  for (const { wav, offset } of chunks) {
    const audioBase64 = await blobToBase64(wav)
    const out = await postJson<{ cues?: Cue[]; words?: Cue[] }>('/api/ai-transcribe', {
      audioBase64,
      mimeType: 'audio/wav',
    })
    for (const c of out.cues ?? []) cues.push({ ...c, start: c.start + offset, end: c.end + offset })
    for (const w of out.words ?? []) words.push({ ...w, start: w.start + offset, end: w.end + offset })
  }
  return { cues, words }
}
