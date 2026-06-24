import { describe, it, expect } from 'vitest'
import { keyframeValueAt, applyEase, upsertKeyframe, transformAt } from './keyframes'
import type { Clip } from '#/types/editor'

describe('keyframeValueAt', () => {
  const keys = [{ t: 0, value: 0 }, { t: 4, value: 1 }]
  it('linear interpolates and clamps the ends', () => {
    expect(keyframeValueAt(keys, -1, 9)).toBe(0)
    expect(keyframeValueAt(keys, 2, 9)).toBeCloseTo(0.5)
    expect(keyframeValueAt(keys, 5, 9)).toBe(1)
  })
  it('uses the fallback when empty', () => {
    expect(keyframeValueAt(undefined, 1, 0.7)).toBe(0.7)
    expect(keyframeValueAt([], 1, 0.7)).toBe(0.7)
  })
})

describe('applyEase', () => {
  it('is symmetric at the ends', () => {
    for (const e of ['linear', 'in', 'out', 'inout'] as const) {
      expect(applyEase(0, e)).toBeCloseTo(0)
      expect(applyEase(1, e)).toBeCloseTo(1)
    }
  })
  it('ease-in starts slow', () => {
    expect(applyEase(0.5, 'in')).toBeCloseTo(0.25)
  })
  it('ease-out ends slow', () => {
    expect(applyEase(0.5, 'out')).toBeCloseTo(0.75)
  })
  it('hold stays at the start until the next key', () => {
    expect(applyEase(0.9, 'hold')).toBe(0)
  })
})

describe('eased keyframe interpolation', () => {
  it('applies the left keyframe ease to its segment', () => {
    const keys = [{ t: 0, value: 0, ease: 'in' as const }, { t: 1, value: 1 }]
    // ease-in at f=0.5 → 0.25
    expect(keyframeValueAt(keys, 0.5, 0)).toBeCloseTo(0.25)
  })
})

describe('upsertKeyframe', () => {
  it('preserves easing when updating a value', () => {
    const keys = [{ t: 0, value: 0, ease: 'inout' as const }]
    const next = upsertKeyframe(keys, 0, 0.8)
    expect(next[0]).toEqual({ t: 0, value: 0.8, ease: 'inout' })
  })
})

describe('transformAt', () => {
  it('resolves keyframed props and falls back to the static transform', () => {
    const clip = {
      transform: { x: 0.1, y: 0, scale: 2, rotation: 0, opacity: 1 },
      keyframes: { opacity: [{ t: 0, value: 0 }, { t: 2, value: 1 }] },
    } as unknown as Clip
    const at1 = transformAt(clip, 1)
    expect(at1.opacity).toBeCloseTo(0.5) // keyframed
    expect(at1.scale).toBe(2) // static fallback
    expect(at1.x).toBeCloseTo(0.1)
  })
})
