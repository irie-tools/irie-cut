// Client helpers for the AI serverless functions (/api/ai-*). These return
// friendly errors when AI isn't configured (no key) so the UI can degrade.

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
  const audioBase64 = await blobToBase64(blob)
  const out = await postJson<{ cues: Cue[]; words?: Cue[] }>('/api/ai-transcribe', {
    audioBase64,
    mimeType: blob.type,
  })
  return { cues: out.cues ?? [], words: out.words ?? [] }
}
