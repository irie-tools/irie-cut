// Serverless: audio transcription → timed caption cues. Client posts the clip's
// audio as base64; we forward it to an OpenAI-compatible transcription endpoint
// (whisper) and return verbose segments. Env: AI_GATEWAY_API_KEY / AI_BASE_URL /
// AI_TRANSCRIBE_MODEL (default whisper-1). Bodies can be large; allow up to ~25MB.

export const config = { api: { bodyParser: { sizeLimit: '25mb' } } }

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  // Transcription goes direct to OpenAI Whisper (the gateway has no audio endpoint).
  // Override with AI_TRANSCRIBE_* to point at another OpenAI-compatible provider.
  const key = process.env.AI_TRANSCRIBE_API_KEY || process.env.OPENAI_API_KEY || process.env.AI_GATEWAY_API_KEY
  if (!key) {
    return res.status(503).json({ error: 'Auto-captions need OPENAI_API_KEY in your Vercel project env.' })
  }
  const base = process.env.AI_TRANSCRIBE_BASE_URL || 'https://api.openai.com/v1'
  const model = process.env.AI_TRANSCRIBE_MODEL || 'whisper-1'
  const { audioBase64, mimeType } = (req.body || {}) as { audioBase64?: string; mimeType?: string }
  if (!audioBase64) return res.status(400).json({ error: 'Missing audio.' })

  try {
    const bytes = Buffer.from(audioBase64, 'base64')
    const form = new FormData()
    form.append('file', new Blob([bytes], { type: mimeType || 'audio/mp4' }), 'audio')
    form.append('model', model)
    form.append('response_format', 'verbose_json')
    // Ask for both phrase- and word-level timing (word timing powers karaoke + re-sync).
    form.append('timestamp_granularities[]', 'segment')
    form.append('timestamp_granularities[]', 'word')

    const r = await fetch(`${base}/audio/transcriptions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}` },
      body: form,
    })
    if (!r.ok) return res.status(502).json({ error: 'Transcription failed', detail: await r.text() })
    const data = await r.json()
    const segments = (data?.segments ?? []) as { start: number; end: number; text: string }[]
    const cues = segments.map((s) => ({ start: s.start, end: s.end, text: (s.text || '').trim() })).filter((c) => c.text)
    const rawWords = (data?.words ?? []) as { start: number; end: number; word: string }[]
    const words = rawWords
      .map((w) => ({ start: w.start, end: w.end, text: (w.word || '').trim() }))
      .filter((w) => w.text && Number.isFinite(w.start) && Number.isFinite(w.end))
    // Fall back to a single cue if the provider returned only plain text.
    if (!cues.length && data?.text) cues.push({ start: 0, end: 0, text: String(data.text).trim() })
    return res.status(200).json({ cues, words })
  } catch (e) {
    return res.status(502).json({ error: 'Transcription failed', detail: String(e) })
  }
}
