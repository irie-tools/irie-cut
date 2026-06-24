// Serverless: marketing copy assist. Dependency-free. Tries the Vercel AI
// Gateway (Claude) first, then falls back to OpenAI directly — so it works as
// long as either AI_GATEWAY_API_KEY or OPENAI_API_KEY is set, and auto-upgrades
// to Claude once the gateway has access (BYOK or paid credits).
//   AI_GATEWAY_API_KEY / AI_BASE_URL / AI_TEXT_MODEL (default anthropic/claude-sonnet-4.6)
//   OPENAI_API_KEY / AI_OPENAI_TEXT_MODEL (default gpt-4o-mini)

const SYSTEM: Record<string, string> = {
  hook: 'You write scroll-stopping first-line hooks for short-form video. Return 5 distinct options, one per line, no numbering, under 12 words each.',
  cta: 'You write punchy calls-to-action for short-form video end cards. Return 5 options, one per line, no numbering, under 8 words each.',
  caption: 'You write concise on-screen captions for short-form video. Return 5 caption lines, one per line, no numbering.',
  script: 'You write tight short-form video scripts as beats. Return 6 beats (hook, problem, proof, product, benefit, CTA), one per line, no numbering.',
}

function chat(base: string, key: string, model: string, sys: string, prompt: string) {
  return fetch(`${base}/chat/completions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      temperature: 0.9,
      messages: [
        { role: 'system', content: sys },
        { role: 'user', content: prompt },
      ],
    }),
  })
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const { prompt, kind } = (req.body || {}) as { prompt?: string; kind?: string }
  if (!prompt) return res.status(400).json({ error: 'Missing prompt.' })
  const sys = SYSTEM[kind ?? 'hook'] ?? SYSTEM.hook

  const attempts: { base: string; key: string; model: string }[] = []
  const gwKey = process.env.AI_GATEWAY_API_KEY || process.env.AI_API_KEY
  if (gwKey) {
    attempts.push({
      base: process.env.AI_BASE_URL || 'https://ai-gateway.vercel.sh/v1',
      key: gwKey,
      model: process.env.AI_TEXT_MODEL || 'anthropic/claude-sonnet-4.6',
    })
  }
  if (process.env.OPENAI_API_KEY) {
    attempts.push({
      base: 'https://api.openai.com/v1',
      key: process.env.OPENAI_API_KEY,
      model: process.env.AI_OPENAI_TEXT_MODEL || 'gpt-4o-mini',
    })
  }
  if (!attempts.length) {
    return res.status(503).json({ error: 'AI is not configured. Add AI_GATEWAY_API_KEY or OPENAI_API_KEY in Vercel env.' })
  }

  let lastErr = ''
  for (const a of attempts) {
    try {
      const r = await chat(a.base, a.key, a.model, sys, prompt)
      if (r.ok) {
        const data = await r.json()
        const text: string = data?.choices?.[0]?.message?.content ?? ''
        const variants = text
          .split('\n')
          .map((s) => s.replace(/^\s*[-*\d.)]+\s*/, '').trim())
          .filter(Boolean)
        return res.status(200).json({ variants, model: a.model })
      }
      lastErr = await r.text()
    } catch (e) {
      lastErr = String(e)
    }
  }
  return res.status(502).json({ error: 'AI request failed', detail: lastErr })
}
