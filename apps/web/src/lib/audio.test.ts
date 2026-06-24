import { describe, it, expect } from 'vitest'
import { clipVolumeAt, audioEnvelope, effectiveGain } from './audio'
import type { Clip, Project, Track } from '#/types/editor'

const clip = (over: Partial<Clip> = {}): Clip => ({
  id: 'c', trackId: 't', type: 'audio', name: 'a',
  start: 2, duration: 4, trimStart: 0, trimEnd: 4, volume: 0.8, ...over,
})

describe('clipVolumeAt', () => {
  it('returns the static volume without keyframes', () => {
    expect(clipVolumeAt(clip(), 3)).toBe(0.8)
  })
  it('interpolates volume automation in clip-local time', () => {
    const c = clip({ volume: 1, volumeKeyframes: [{ t: 0, value: 0 }, { t: 4, value: 1 }] })
    expect(clipVolumeAt(c, 2)).toBeCloseTo(0) // t == start → local 0
    expect(clipVolumeAt(c, 4)).toBeCloseTo(0.5) // local 2 → midpoint
    expect(clipVolumeAt(c, 6)).toBeCloseTo(1) // local 4 → end
  })
})

describe('audioEnvelope', () => {
  it('applies dedicated fade in/out', () => {
    const c = clip({ fadeIn: 1, fadeOut: 1 }) // span [2,6]
    expect(audioEnvelope(c, 2)).toBeCloseTo(0)
    expect(audioEnvelope(c, 2.5)).toBeCloseTo(0.5)
    expect(audioEnvelope(c, 4)).toBeCloseTo(1)
    expect(audioEnvelope(c, 5.5)).toBeCloseTo(0.5)
    expect(audioEnvelope(c, 6)).toBeCloseTo(0)
  })
})

describe('effectiveGain', () => {
  const track: Track = { id: 't', type: 'audio', name: 'A', muted: false, volume: 1, clips: [] }
  const project: Project = { id: 'p', name: 'p', createdAt: 0, updatedAt: 0, width: 1, height: 1, fps: 30, background: '#000', masterVolume: 1, tracks: [track] }
  it('combines automation, track, master, and fades', () => {
    const c = clip({ volume: 1, volumeKeyframes: [{ t: 0, value: 0 }, { t: 4, value: 1 }], fadeIn: 0, fadeOut: 0 })
    expect(effectiveGain(project, track, c, 4, false)).toBeCloseTo(0.5)
  })
  it('mutes a muted track', () => {
    expect(effectiveGain(project, { ...track, muted: true }, clip(), 3, false)).toBe(0)
  })
})
