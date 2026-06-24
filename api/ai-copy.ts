// Serverless: marketing copy assist. Dependency-free — calls an OpenAI-compatible
// chat endpoint (defaults to the Vercel AI Gateway). Configure with env vars:
//   AI_GATEWAY_API_KEY (or AI_API_KEY / OPENAI_API_KEY)
//   AI_BASE_URL    (default https://ai-gateway.vercel.sh/v1)
//   AI_TEXT_MODEL  (default openai/gpt-4o-mini)

const SYSTEM: Record<string, string> = {
  hook: 'You write scroll-stopping first-line hooks for short-form video. Return 5 distinct options, one per line, no numbering, under 12 words each.',
  cta: 'You write punchy calls-to-action for short-form video end cards. Return 5 options, one per line, no numbering, under 8 words each.',
  caption: 'You write concise on-screen captions for short-form video. Return 5 caption lines, one per line, no numbering.',
  script: 'You write tight short-form video scripts as beats. Return 6 beats (hook, problem, proof, product, benefit, CTA), one per line, no numbering.',
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const key = process.env.AI_GATEWAY_API_KEY || process.env.AI_API_KEY || process.env.OPENAI_API_KEY
  if (!key) {
    return res.status(503).json({ error: 'AI is not configured. Add AI_GATEWAY_API_KEY in your Vercel project env.' })
  }
  const base = process.env.AI_BASE_URL || 'https://ai-gateway.vercel.sh/v1'
  const model = process.env.AI_TEXT_MODEL || 'openai/gpt-4o-mini'
  const { prompt, kind } = (req.body || {}) as { prompt?: string; kind?: string }
  if (!prompt) return res.status(400).json({ error: 'Missing prompt.' })

  try {
    const r = await fetch(`${base}/chat/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        temperature: 0.9,
        messages: [
          { role: 'system', content: SYSTEM[kind ?? 'hook'] ?? SYSTEM.hook },
          { role: 'user', content: prompt },
        ],
      }),
    })
    if (!r.ok) return res.status(502).json({ error: 'AI request failed', detail: await r.text() })
    const data = await r.json()
    const text: string = data?.choices?.[0]?.message?.content ?? ''
    const variants = text
      .split('\n')
      .map((s) => s.replace(/^\s*[-*\d.)]+\s*/, '').trim())
      .filter(Boolean)
    return res.status(200).json({ variants })
  } catch (e) {
    return res.status(502).json({ error: 'AI request failed', detail: String(e) })
  }
}
