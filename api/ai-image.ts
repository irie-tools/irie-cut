// Serverless: image generation. Calls an OpenAI-compatible images endpoint
// (defaults to the Vercel AI Gateway). Returns a data URL the client imports
// as a media asset. Env: AI_GATEWAY_API_KEY / AI_BASE_URL / AI_IMAGE_MODEL.

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const key = process.env.AI_GATEWAY_API_KEY || process.env.AI_API_KEY || process.env.OPENAI_API_KEY
  if (!key) {
    return res.status(503).json({ error: 'AI is not configured. Add AI_GATEWAY_API_KEY in your Vercel project env.' })
  }
  const base = process.env.AI_BASE_URL || 'https://ai-gateway.vercel.sh/v1'
  const model = process.env.AI_IMAGE_MODEL || 'openai/gpt-image-1'
  const { prompt, size } = (req.body || {}) as { prompt?: string; size?: string }
  if (!prompt) return res.status(400).json({ error: 'Missing prompt.' })

  try {
    const r = await fetch(`${base}/images/generations`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, prompt, size: size || '1024x1024', n: 1 }),
    })
    if (!r.ok) return res.status(502).json({ error: 'Image request failed', detail: await r.text() })
    const data = await r.json()
    const item = data?.data?.[0]
    const dataUrl = item?.b64_json ? `data:image/png;base64,${item.b64_json}` : item?.url
    if (!dataUrl) return res.status(502).json({ error: 'No image returned.' })
    return res.status(200).json({ dataUrl })
  } catch (e) {
    return res.status(502).json({ error: 'Image request failed', detail: String(e) })
  }
}
