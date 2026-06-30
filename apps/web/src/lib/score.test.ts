import { describe, expect, it } from 'vitest'
import { scoreProject } from './score'
import type { Clip, Project, Track } from '#/types/editor'

function clip(over: Partial<Clip>): Clip {
  return {
    id: over.id ?? 'c',
    trackId: over.trackId ?? 'v',
    type: over.type ?? 'video',
    name: over.name ?? 'clip',
    start: over.start ?? 0,
    duration: over.duration ?? 5,
    trimStart: 0,
    trimEnd: over.duration ?? 5,
    volume: over.volume ?? 1,
    ...over,
  }
}

function project(tracks: Track[], over: Partial<Project> = {}): Project {
  return {
    id: 'p',
    name: 'project',
    createdAt: 0,
    updatedAt: 0,
    width: 1080,
    height: 1920,
    fps: 30,
    background: '#000',
    tracks,
    ...over,
  }
}

function track(id: string, type: Track['type'], clips: Clip[]): Track {
  return { id, type, name: id, muted: false, clips }
}

function check(p: Project, id: string) {
  const found = scoreProject(p).checks.find((c) => c.id === id)
  if (!found) throw new Error(`Missing check ${id}`)
  return found
}

describe('scoreProject export readiness', () => {
  it('flags a black opening and visual gap before export', () => {
    const p = project([track('v', 'video', [clip({ start: 1, duration: 4 })])])

    expect(check(p, 'opening-frame').status).toBe('bad')
    expect(check(p, 'visual-gaps').status).toBe('warn')
  })

  it('flags tiny or unsafe text', () => {
    const p = project([
      track('v', 'video', [clip({ duration: 12 })]),
      track('t', 'text', [
        clip({
          trackId: 't',
          type: 'text',
          duration: 6,
          text: { content: 'tiny', fontSize: 30, color: '#fff', fontFamily: 'Inter', x: 0.5, y: 0.95, align: 'center', bold: true, italic: false },
        }),
      ]),
    ])

    expect(check(p, 'text-size').status).toBe('bad')
    expect(check(p, 'safe-zone').status).toBe('warn')
  })

  it('flags loud overlapping audio without automation', () => {
    const p = project([
      track('v', 'video', [clip({ duration: 12 })]),
      track('a', 'audio', [
        clip({ id: 'a1', trackId: 'a', type: 'audio', start: 0, duration: 8, volume: 1 }),
        clip({ id: 'a2', trackId: 'a', type: 'audio', start: 2, duration: 8, volume: 0.9 }),
      ]),
    ])

    expect(check(p, 'audio-balance').status).toBe('warn')
  })

  it('passes readiness checks for a covered, readable, faded cut', () => {
    const p = project([
      track('v', 'video', [clip({ duration: 15, volume: 0 })]),
      track('t', 'text', [
        clip({
          id: 'hook',
          trackId: 't',
          type: 'text',
          start: 0,
          duration: 8,
          text: { content: 'Hook', fontSize: 96, color: '#fff', fontFamily: 'Inter', x: 0.5, y: 0.8, align: 'center', bold: true, italic: false },
        }),
        clip({
          id: 'cta',
          trackId: 't',
          type: 'text',
          start: 12,
          duration: 3,
          role: 'cta',
          text: { content: 'Follow', fontSize: 90, color: '#fff', fontFamily: 'Inter', x: 0.5, y: 0.72, align: 'center', bold: true, italic: false },
        }),
      ]),
      track('a', 'audio', [clip({ trackId: 'a', type: 'audio', duration: 15, fadeOut: 1 })]),
    ])

    const readiness = scoreProject(p).checks.filter((c) => c.group === 'readiness')
    expect(readiness.every((c) => c.status === 'good')).toBe(true)
  })
})
