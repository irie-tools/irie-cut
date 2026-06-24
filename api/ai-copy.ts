// Serverless: marketing copy assist. Dependency-free. Tries providers in order
// and uses the first that succeeds, so it works with whatever you've configured:
//   1. ANTHROPIC_API_KEY            -> Anthropic Messages API directly (Claude)
//   2. AI_GATEWAY_API_KEY           -> Vercel AI Gateway (OpenAI-compatible, Claude)
//   3. OPENAI_API_KEY               -> OpenAI directly
// Overrides: AI_ANTHROPIC_MODEL (default claude-sonnet-4-6), AI_TEXT_MODEL
// (gateway slug, default anthropic/claude-sonnet-4.6), AI_OPENAI_TEXT_MODEL
// (default gpt-4o-mini), AI_BASE_URL (gateway base).

const SYSTEM: Record<string, string> = {
  hook: 'You write scroll-stopping first-line hooks for short-form video. Return 5 distinct options, one per line, no numbering, under 12 words each.',
  cta: 'You write punchy calls-to-action for short-form video end cards. Return 5 options, one per line, no numbering, under 8 words each.',
  caption: 'You write concise on-screen captions for short-form video. Return 5 caption lines, one per line, no numbering.',
  script: 'You write tight short-form video scripts as beats. Return 6 beats (hook, problem, proof, product, benefit, CTA), one per line, no numbering.',
}

function toVariants(text: string): string[] {
  return text
    .split('\n')
    .map((s) => s.replace(/^\s*[-*\d.)]+\s*/, '').trim())
    .filter(Boolean)
}

async function anthropicCopy(key: string, model: string, sys: string, prompt: string): Promise<string[]> {
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({
      model,
      max_tokens: 1024,
      temperature: 0.9,
      system: sys,
      messages: [{ role: 'user', content: prompt }],
    }),
  })
  if (!r.ok) throw new Error(await r.text())
  const data = await r.json()
  const text: string = (data?.content ?? [])
    .filter((c: { type: string }) => c.type === 'text')
    .map((c: { text: string }) => c.text)
    .join('\n')
  return toVariants(text)
}

async function openAICompatibleCopy(base: string, key: string, model: string, sys: string, prompt: string): Promise<string[]> {
  const r = await fetch(`${base}/chat/completions`, {
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
  if (!r.ok) throw new Error(await r.text())
  const data = await r.json()
  return toVariants(data?.choices?.[0]?.message?.content ?? '')
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const { prompt, kind } = (req.body || {}) as { prompt?: string; kind?: string }
  if (!prompt) return res.status(400).json({ error: 'Missing prompt.' })
  const sys = SYSTEM[kind ?? 'hook'] ?? SYSTEM.hook

  const attempts: { run: () => Promise<string[]>; model: string }[] = []

  if (process.env.ANTHROPIC_API_KEY) {
    const model = process.env.AI_ANTHROPIC_MODEL || 'claude-sonnet-4-6'
    attempts.push({ model, run: () => anthropicCopy(process.env.ANTHROPIC_API_KEY as string, model, sys, prompt) })
  }
  const gwKey = process.env.AI_GATEWAY_API_KEY || process.env.AI_API_KEY
  if (gwKey) {
    const base = process.env.AI_BASE_URL || 'https://ai-gateway.vercel.sh/v1'
    const model = process.env.AI_TEXT_MODEL || 'anthropic/claude-sonnet-4.6'
    attempts.push({ model, run: () => openAICompatibleCopy(base, gwKey, model, sys, prompt) })
  }
  if (process.env.OPENAI_API_KEY) {
    const model = process.env.AI_OPENAI_TEXT_MODEL || 'gpt-4o-mini'
    attempts.push({ model, run: () => openAICompatibleCopy('https://api.openai.com/v1', process.env.OPENAI_API_KEY as string, model, sys, prompt) })
  }
  if (!attempts.length) {
    return res.status(503).json({ error: 'AI is not configured. Add ANTHROPIC_API_KEY, AI_GATEWAY_API_KEY, or OPENAI_API_KEY in Vercel env.' })
  }

  let lastErr = ''
  for (const a of attempts) {
    try {
      const variants = await a.run()
      if (variants.length) return res.status(200).json({ variants, model: a.model })
    } catch (e) {
      lastErr = String(e)
    }
  }
  return res.status(502).json({ error: 'AI request failed', detail: lastErr })
}
