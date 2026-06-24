import { describe, it, expect } from 'vitest'
import { hexToRgb01 } from './chroma'

describe('hexToRgb01', () => {
  it('parses 6-digit hex', () => {
    expect(hexToRgb01('#00ff00')).toEqual([0, 1, 0])
    expect(hexToRgb01('#ffffff')).toEqual([1, 1, 1])
    expect(hexToRgb01('#000000')).toEqual([0, 0, 0])
  })
  it('parses 3-digit shorthand', () => {
    expect(hexToRgb01('#0f0')).toEqual([0, 1, 0])
  })
  it('tolerates a missing hash', () => {
    expect(hexToRgb01('ff0000')).toEqual([1, 0, 0])
  })
})
