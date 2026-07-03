import { describe, expect, it } from 'vitest'
import { isNeutralQuality, qualityCss } from './quality'

describe('qualityCss', () => {
  it('returns no filter for neutral quality settings', () => {
    expect(isNeutralQuality(undefined)).toBe(true)
    expect(qualityCss({ enhance: false, denoise: 0 })).toBe('')
  })

  it('builds deterministic enhance and denoise filters', () => {
    expect(isNeutralQuality({ enhance: true })).toBe(false)
    expect(qualityCss({ enhance: true, denoise: 0.5 })).toBe('contrast(1.08) saturate(1.08) brightness(1.02) blur(0.35px)')
  })
})
