// Caption export. Text clips on the timeline are timed cues, so we can emit
// valid SRT / WebVTT subtitle files straight from them — ported from the media
// studio's caption engine, driven by Irie Cut's real timeline timing.

import type { Project } from '#/types/editor'

export interface Cue {
  start: number
  end: number
  text: string
}

/** Collect non-empty text clips as time-ordered caption cues. */
export function buildCues(project: Project): Cue[] {
  const cues: Cue[] = []
  for (const track of project.tracks) {
    for (const clip of track.clips) {
      if (clip.type !== 'text') continue
      const text = clip.text?.content?.trim()
      if (!text) continue
      cues.push({ start: clip.start, end: clip.start + clip.duration, text })
    }
  }
  return cues.sort((a, b) => a.start - b.start)
}

function pad(n: number, width = 2): string {
  return Math.floor(n).toString().padStart(width, '0')
}

/** Format seconds as HH:MM:SS plus a milliseconds part using the given separator. */
function stamp(seconds: number, msSep: ',' | '.'): string {
  const s = Math.max(0, seconds)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = Math.floor(s % 60)
  const ms = Math.round((s - Math.floor(s)) * 1000)
  return `${pad(h)}:${pad(m)}:${pad(sec)}${msSep}${pad(ms, 3)}`
}

export function buildSrt(project: Project): string {
  const cues = buildCues(project)
  return cues
    .map((c, i) => `${i + 1}\n${stamp(c.start, ',')} --> ${stamp(c.end, ',')}\n${c.text}`)
    .join('\n\n')
    .concat('\n')
}

export function buildVtt(project: Project): string {
  const cues = buildCues(project)
  const body = cues
    .map((c) => `${stamp(c.start, '.')} --> ${stamp(c.end, '.')}\n${c.text}`)
    .join('\n\n')
  return `WEBVTT\n\n${body}\n`
}
