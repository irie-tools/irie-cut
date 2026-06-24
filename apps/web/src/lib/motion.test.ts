import { describe, it, expect } from 'vitest'
import { motionKeyframes } from './motion'

describe('motionKeyframes — cinematic', () => {
  it('scales to a long song: many phases, not one timid ramp', () => {
    const kf = motionKeyframes('cinematic', { duration: 204 })
    // ~204/15 ≈ 14 phases — far more than the old 2-keyframe ramp.
    expect(kf.scale!.length).toBeGreaterThanOrEqual(12)
    expect(kf.x!.length).toBe(kf.scale!.length)
  })

  it('zoom actually varies (perceptible), not a flat creep', () => {
    const kf = motionKeyframes('cinematic', { duration: 204 })
    const vals = kf.scale!.map((k) => k.value)
    expect(Math.max(...vals) - Math.min(...vals)).toBeGreaterThanOrEqual(0.08)
  })

  it('first keyframe at 0, last exactly at duration, time-sorted', () => {
    const kf = motionKeyframes('cinematic', { duration: 204 })
    const t = kf.scale!.map((k) => k.t)
    expect(t[0]).toBe(0)
    expect(t[t.length - 1]).toBeCloseTo(204)
    for (let i = 1; i < t.length; i++) expect(t[i]).toBeGreaterThan(t[i - 1])
  })

  it('pan never exceeds the overscan from the zoom (no edge reveal)', () => {
    const kf = motionKeyframes('cinematic', { duration: 120 })
    kf.scale!.forEach((s, i) => {
      const margin = (s.value - 1) / 2
      expect(Math.abs(kf.x![i].value)).toBeLessThanOrEqual(margin + 1e-6)
      expect(Math.abs(kf.y![i].value)).toBeLessThanOrEqual(margin + 1e-6)
    })
  })
})

describe('motionKeyframes — other presets', () => {
  it('beatPulse punches on beats', () => {
    const kf = motionKeyframes('beatPulse', { duration: 8, beats: [1, 2, 3, 4, 5, 6] })
    // a base + two keyframes per beat → well more than 2
    expect(kf.scale!.length).toBeGreaterThan(6)
    expect(Math.max(...kf.scale!.map((k) => k.value))).toBeGreaterThan(1.1)
  })

  it('beatPulse with no beats falls back to visible motion', () => {
    const kf = motionKeyframes('beatPulse', { duration: 30, beats: [] })
    expect(kf.scale!.length).toBeGreaterThan(2)
  })

  it('driftReveal and punchIn return valid, sorted keyframes ending at duration', () => {
    for (const p of ['driftReveal', 'punchIn'] as const) {
      const kf = motionKeyframes(p, { duration: 40 })
      const t = kf.scale!.map((k) => k.t)
      expect(t[0]).toBe(0)
      expect(t[t.length - 1]).toBeCloseTo(40)
      for (let i = 1; i < t.length; i++) expect(t[i]).toBeGreaterThanOrEqual(t[i - 1])
    }
  })

  it('none clears motion', () => {
    expect(motionKeyframes('none', { duration: 30 })).toEqual({})
  })
})
