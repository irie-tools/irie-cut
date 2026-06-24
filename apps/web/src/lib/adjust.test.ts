import { describe, it, expect } from 'vitest'
import { adjustCss, isNeutralAdjust, DEFAULT_ADJUST } from './adjust'

describe('adjustCss', () => {
  it('returns empty string for neutral / undefined', () => {
    expect(adjustCss(undefined)).toBe('')
    expect(adjustCss(DEFAULT_ADJUST)).toBe('')
    expect(adjustCss({ brightness: 1, contrast: 1, saturation: 1, hue: 0 })).toBe('')
  })

  it('builds a CSS filter string in a stable order', () => {
    expect(adjustCss({ brightness: 1.2, contrast: 0.9, saturation: 1.5, hue: 30 })).toBe(
      'brightness(1.2) contrast(0.9) saturate(1.5) hue-rotate(30deg)',
    )
  })

  it('omits channels that are at their neutral value', () => {
    expect(adjustCss({ brightness: 1.1 })).toBe('brightness(1.1)')
    expect(adjustCss({ hue: -45 })).toBe('hue-rotate(-45deg)')
    expect(adjustCss({ saturation: 0 })).toBe('saturate(0)')
  })

  it('rounds noisy slider values', () => {
    expect(adjustCss({ brightness: 1.2000001 })).toBe('brightness(1.2)')
  })
})

describe('isNeutralAdjust', () => {
  it('is true for undefined and the default', () => {
    expect(isNeutralAdjust(undefined)).toBe(true)
    expect(isNeutralAdjust(DEFAULT_ADJUST)).toBe(true)
  })
  it('is false when any channel is moved', () => {
    expect(isNeutralAdjust({ brightness: 1.2 })).toBe(false)
    expect(isNeutralAdjust({ contrast: 0.8 })).toBe(false)
    expect(isNeutralAdjust({ saturation: 1.3 })).toBe(false)
    expect(isNeutralAdjust({ hue: 10 })).toBe(false)
  })
})
