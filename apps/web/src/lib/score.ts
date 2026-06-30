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
  group?: 'creative' | 'readiness'
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

function endOf(c: Clip): number {
  return c.start + c.duration
}

function hasAudio(c: Clip): boolean {
  return c.type === 'audio' || c.type === 'video'
}

function volumeLooksAutomated(c: Clip): boolean {
  return (c.volumeKeyframes?.length ?? 0) > 1
}

function hasEndingFade(c: Clip): boolean {
  return (c.fadeOut ?? 0) >= 0.3 || (c.volumeKeyframes?.some((k) => k.t >= c.duration - 1 && k.value <= 0.1) ?? false)
}

function longestVisualGap(visuals: Clip[], total: number): number {
  if (!visuals.length || total <= 0) return total
  const ranges = visuals
    .map((c) => ({ start: Math.max(0, c.start), end: Math.min(total, endOf(c)) }))
    .filter((r) => r.end > r.start)
    .sort((a, b) => a.start - b.start)
  if (!ranges.length) return total

  let longest = Math.max(0, ranges[0].start)
  let cursor = ranges[0].end
  for (const r of ranges.slice(1)) {
    if (r.start > cursor) longest = Math.max(longest, r.start - cursor)
    cursor = Math.max(cursor, r.end)
  }
  return Math.max(longest, total - cursor)
}

function hasLoudAudioOverlap(clips: Clip[]): boolean {
  const audio = clips.filter(hasAudio).sort((a, b) => a.start - b.start)
  for (let i = 0; i < audio.length; i++) {
    for (let j = i + 1; j < audio.length; j++) {
      if (audio[j].start >= endOf(audio[i])) break
      const loud = audio[i].volume >= 0.65 && audio[j].volume >= 0.65
      const managed = volumeLooksAutomated(audio[i]) || volumeLooksAutomated(audio[j]) || (audio[i].fadeIn ?? 0) > 0 || (audio[j].fadeIn ?? 0) > 0
      if (loud && !managed) return true
    }
  }
  return false
}

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
      ? { id: 'visuals', label: 'Has footage', status: 'good', detail: `${visuals.length} visual clip(s) on the timeline.`, weight: 2, group: 'creative' }
      : { id: 'visuals', label: 'Has footage', status: 'bad', detail: 'No video or images — add some footage so this is more than a title card.', weight: 2, group: 'creative' },
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
    group: 'creative',
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
    group: 'creative',
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
  checks.push({ id: 'duration', label: 'Length for platform', status: durStatus, detail: durDetail, weight: 1, group: 'readiness' })

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
    group: 'creative',
  })

  // 6. Audio present
  checks.push({
    id: 'audio',
    label: 'Has audio',
    status: audibles.length ? 'good' : 'warn',
    detail: audibles.length ? 'There’s an audio source.' : 'No audio — add music or voiceover for retention.',
    weight: 1,
    group: 'creative',
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
  checks.push({ id: 'pacing', label: 'Cut pacing', status: pace, detail: paceDetail, weight: 1, group: 'creative' })

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
    group: 'readiness',
  })

  // 9. Opening frame is not blank/black.
  const firstVisual = visuals.reduce((m, c) => Math.min(m, c.start), Number.POSITIVE_INFINITY)
  let openingStatus: CheckStatus = 'good'
  let openingDetail = 'A visual clip is active at the opening frame.'
  if (!visuals.length) {
    openingStatus = 'bad'
    openingDetail = 'No visual clip is available for the opening frame.'
  } else if (firstVisual > 0.75) {
    openingStatus = 'bad'
    openingDetail = `The first visual starts at ${firstVisual.toFixed(1)}s — the export opens on black.`
  } else if (firstVisual > 0.1) {
    openingStatus = 'warn'
    openingDetail = `The first visual starts at ${firstVisual.toFixed(1)}s — tighten it to 0:00.`
  }
  checks.push({ id: 'opening-frame', label: 'Opening frame', status: openingStatus, detail: openingDetail, weight: 1.5, group: 'readiness' })

  // 10. No long black/empty visual gaps.
  const gap = longestVisualGap(visuals, total)
  let gapStatus: CheckStatus = 'good'
  let gapDetail = 'No long empty visual gaps detected.'
  if (gap > 2) {
    gapStatus = 'bad'
    gapDetail = `There is a ${gap.toFixed(1)}s visual gap — cover it before export.`
  } else if (gap > 0.5) {
    gapStatus = 'warn'
    gapDetail = `There is a ${gap.toFixed(1)}s visual gap — check whether that black space is intentional.`
  }
  checks.push({ id: 'visual-gaps', label: 'Visual gaps', status: gapStatus, detail: gapDetail, weight: 1.25, group: 'readiness' })

  // 11. Text is readable at platform size.
  const textRatios = texts.map((c) => (c.text?.fontSize ?? 0) / project.height).filter((n) => n > 0)
  const minText = textRatios.length ? Math.min(...textRatios) : 0
  let textSizeStatus: CheckStatus = 'good'
  let textSizeDetail = textRatios.length ? `Smallest text is ${Math.round(minText * 1000) / 10}% of frame height.` : 'No text clips to size-check.'
  if (!textRatios.length) {
    textSizeStatus = 'warn'
  } else if (minText < 0.022) {
    textSizeStatus = 'bad'
    textSizeDetail = 'Some text is too small for mobile viewing — increase caption/title size.'
  } else if (minText < 0.032) {
    textSizeStatus = 'warn'
    textSizeDetail = 'Some text may be small on phones — preview it at mobile size.'
  }
  checks.push({ id: 'text-size', label: 'Readable text', status: textSizeStatus, detail: textSizeDetail, weight: 1, group: 'readiness' })

  // 12. Caption/title safe zones for platform UI.
  const unsafe = texts.filter((c) => {
    const x = c.text?.x ?? 0.5
    const y = c.text?.y ?? 0.5
    return x < 0.08 || x > 0.92 || y < 0.08 || y > (o === 'landscape' ? 0.94 : 0.88)
  }).length
  checks.push({
    id: 'safe-zone',
    label: 'Text safe zone',
    status: unsafe === 0 ? 'good' : unsafe > 2 ? 'bad' : 'warn',
    detail: unsafe === 0 ? 'Text stays inside platform-safe margins.' : `${unsafe} text clip(s) may sit under platform controls or too close to an edge.`,
    weight: 1,
    group: 'readiness',
  })

  // 13. Audio does not end with a hard stop.
  const endingAudio = audibles.filter((c) => endOf(c) >= total - 0.5)
  checks.push({
    id: 'audio-ending',
    label: 'Audio ending',
    status: !audibles.length || endingAudio.some(hasEndingFade) ? 'good' : 'warn',
    detail:
      !audibles.length
        ? 'No audio ending to fade.'
        : endingAudio.some(hasEndingFade)
          ? 'At least one ending audio layer fades out cleanly.'
          : 'Audio reaches the end without a fade — add a short fade-out to avoid a hard stop.',
    weight: 0.75,
    group: 'readiness',
  })

  // 14. Loud overlapping audio gets flagged before export.
  const loudAudioOverlap = hasLoudAudioOverlap(clips)
  checks.push({
    id: 'audio-balance',
    label: 'Layered audio balance',
    status: loudAudioOverlap ? 'warn' : 'good',
    detail: loudAudioOverlap
      ? 'Two loud audio layers overlap without automation — lower music under voice or add volume keyframes.'
      : 'No unmanaged loud audio overlap detected.',
    weight: 0.75,
    group: 'readiness',
  })

  const totalWeight = checks.reduce((s, c) => s + c.weight, 0)
  const earned = checks.reduce((s, c) => s + c.weight * STATUS_VALUE[c.status], 0)
  const overall = totalWeight ? Math.round((earned / totalWeight) * 100) : 0

  return { overall, checks }
}
