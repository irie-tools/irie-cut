import { describe, it, expect } from 'vitest'
import { detectBeatsFromSamples } from './beat-detect'

/** Build a click track: short bursts of noise at the given times. */
function clickTrack(times: number[], sampleRate: number, durationSec: number): Float32Array {
  const data = new Float32Array(Math.ceil(sampleRate * durationSec))
  for (const t of times) {
    const start = Math.floor(t * sampleRate)
    for (let j = 0; j < 600; j++) {
      // a short decaying burst
      const idx = start + j
      if (idx < data.length) data[idx] = (1 - j / 600) * (j % 2 === 0 ? 1 : -1)
    }
  }
  return data
}

describe('detectBeatsFromSamples', () => {
  it('finds onsets near the planted click times', () => {
    const sr = 44100
    const planted = [0.5, 1.0, 1.5, 2.0, 2.5]
    const data = clickTrack(planted, sr, 3)
    const beats = detectBeatsFromSamples(data, sr)
    // Each planted click should have a detected beat within ~40ms.
    for (const p of planted) {
      const near = beats.some((b) => Math.abs(b - p) < 0.04)
      expect(near, `beat near ${p}s (got ${beats.map((b) => b.toFixed(2)).join(',')})`).toBe(true)
    }
  })

  it('returns nothing for silence', () => {
    const beats = detectBeatsFromSamples(new Float32Array(44100), 44100)
    expect(beats).toEqual([])
  })

  it('respects the minimum gap (no double triggers)', () => {
    const sr = 44100
    const beats = detectBeatsFromSamples(clickTrack([1.0], sr, 2), sr, { minGap: 0.2 })
    expect(beats.length).toBeLessThanOrEqual(1)
  })
})
