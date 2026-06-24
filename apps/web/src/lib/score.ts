// A real creative scorecard, computed from the actual project — the studio's
// version was a hardcoded label list that never produced a number. Each check
// inspects the timeline and returns a status + an actionable tip.

import type { Clip, Project } from '#/types/editor'

export type CheckStatus = 'good' | 'warn' | 'bad'

export interface ScoreCheck {
  id: string
  label: string
  status: CheckStatus
  detail: string
  weight: number
}

export interface Scorecard {
  overall: number
  checks: ScoreCheck[]
}

function allClips(p: Project): Clip[] {
  return p.tracks.flatMap((t) => t.clips)
}

function duration(p: Project): number {
  return allClips(p).reduce((m, c) => Math.max(m, c.start + c.duration), 0)
}

function orientation(p: Project): 'vertical' | 'square' | 'landscape' {
  const r = p.width / p.height
  if (r < 0.9) return 'vertical'
  if (r < 1.2) return 'square'
  return 'landscape'
}

const STATUS_VALUE: Record<CheckStatus, number> = { good: 1, warn: 0.5, bad: 0 }

export function scoreProject(project: Project): Scorecard {
  const clips = allClips(project)
  const total = duration(project)
  const texts = clips.filter((c) => c.type === 'text')
  const visuals = clips.filter((c) => c.type === 'video' || c.type === 'image')
  const audibles = clips.filter((c) => c.type === 'video' || c.type === 'audio')
  const o = orientation(project)
  const checks: ScoreCheck[] = []

  // 1. Visual content
  checks.push(
    visuals.length
      ? { id: 'visuals', label: 'Has footage', status: 'good', detail: `${visuals.length} visual clip(s) on the timeline.`, weight: 2 }
      : { id: 'visuals', label: 'Has footage', status: 'bad', detail: 'No video or images — add some footage so this is more than a title card.', weight: 2 },
  )

  // 2. Hook in the first 3s
  const hasHook =
    texts.some((c) => c.start < 3) || clips.some((c) => c.role === 'hook' && c.start < 4)
  checks.push({
    id: 'hook',
    label: 'Hook in first 3s',
    status: hasHook ? 'good' : 'bad',
    detail: hasHook
      ? 'Something grabs attention up front.'
      : 'Add a hook (a punchy title or a clip tagged “Hook”) in the first 3 seconds.',
    weight: 2,
  })

  // 3. CTA present
  const hasCta =
    clips.some((c) => c.role === 'cta') ||
    texts.some((c) => c.start + c.duration > total * 0.7)
  checks.push({
    id: 'cta',
    label: 'Has a CTA',
    status: hasCta ? 'good' : 'warn',
    detail: hasCta
      ? 'There’s a call-to-action toward the end.'
      : 'Add a closing call-to-action (tag a clip “CTA” or add an end-card title).',
    weight: 1.5,
  })

  // 4. Duration vs platform
  const ideal = o === 'landscape' ? { lo: 15, hi: 600 } : { lo: 7, hi: 60 }
  let durStatus: CheckStatus = 'good'
  let durDetail = `${Math.round(total)}s suits a ${o} cut.`
  if (total <= 0) {
    durStatus = 'bad'
    durDetail = 'Timeline is empty.'
  } else if (total < ideal.lo) {
    durStatus = 'warn'
    durDetail = `${Math.round(total)}s is short for ${o} — aim for ${ideal.lo}–${ideal.hi}s.`
  } else if (total > ideal.hi) {
    durStatus = 'warn'
    durDetail = `${Math.round(total)}s is long for ${o} — consider a cutdown under ${ideal.hi}s.`
  }
  checks.push({ id: 'duration', label: 'Length for platform', status: durStatus, detail: durDetail, weight: 1 })

  // 5. Caption coverage
  const coverage = total > 0 ? Math.min(1, texts.reduce((s, c) => s + c.duration, 0) / total) : 0
  const covStatus: CheckStatus = coverage >= 0.5 ? 'good' : coverage >= 0.25 ? 'warn' : 'bad'
  checks.push({
    id: 'captions',
    label: 'Caption coverage',
    status: covStatus,
    detail:
      covStatus === 'good'
        ? `${Math.round(coverage * 100)}% of the video has on-screen text.`
        : `Only ${Math.round(coverage * 100)}% has captions — most social viewers watch muted.`,
    weight: 1.5,
  })

  // 6. Audio present
  checks.push({
    id: 'audio',
    label: 'Has audio',
    status: audibles.length ? 'good' : 'warn',
    detail: audibles.length ? 'There’s an audio source.' : 'No audio — add music or voiceover for retention.',
    weight: 1,
  })

  // 7. Pacing (avg visual clip length)
  let pace: CheckStatus = 'good'
  let paceDetail = 'Cut pacing looks healthy.'
  if (!visuals.length) {
    pace = 'bad'
    paceDetail = 'No clips to pace.'
  } else {
    const avg = visuals.reduce((s, c) => s + c.duration, 0) / visuals.length
    if (avg > 10) {
      pace = 'warn'
      paceDetail = `Average shot is ${avg.toFixed(1)}s — tighten cuts to hold attention.`
    } else {
      paceDetail = `Average shot ${avg.toFixed(1)}s — nicely paced.`
    }
  }
  checks.push({ id: 'pacing', label: 'Cut pacing', status: pace, detail: paceDetail, weight: 1 })

  // 8. Aspect ratio is a known social format
  const ratios: { r: number; name: string }[] = [
    { r: 9 / 16, name: '9:16' },
    { r: 4 / 5, name: '4:5' },
    { r: 1, name: '1:1' },
    { r: 16 / 9, name: '16:9' },
    { r: 4 / 3, name: '4:3' },
  ]
  const r = project.width / project.height
  const known = ratios.find((x) => Math.abs(x.r - r) < 0.03)
  checks.push({
    id: 'aspect',
    label: 'Standard aspect',
    status: known ? 'good' : 'warn',
    detail: known ? `${known.name} is platform-ready.` : 'Unusual aspect ratio — most platforms expect 9:16, 1:1, 4:5 or 16:9.',
    weight: 1,
  })

  const totalWeight = checks.reduce((s, c) => s + c.weight, 0)
  const earned = checks.reduce((s, c) => s + c.weight * STATUS_VALUE[c.status], 0)
  const overall = totalWeight ? Math.round((earned / totalWeight) * 100) : 0

  return { overall, checks }
}
