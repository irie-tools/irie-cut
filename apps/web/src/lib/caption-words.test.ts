import { describe, expect, it } from 'vitest'
import { attachWordsToCaptions } from './caption-words'

describe('attachWordsToCaptions', () => {
  it('attaches caption-local word timings to the matching cue', () => {
    const out = attachWordsToCaptions(
      [{ start: 10, end: 12, text: 'hello world' }],
      [
        { start: 10.1, end: 10.4, text: 'hello' },
        { start: 11.1, end: 11.6, text: 'world' },
      ],
    )

    expect(out[0].words?.map((w) => w.text)).toEqual(['hello', 'world'])
    expect(out[0].words?.[0].start).toBeCloseTo(0.1)
    expect(out[0].words?.[1].end).toBeCloseTo(1.6)
  })

  it('keeps captions usable when no words land inside the cue', () => {
    const out = attachWordsToCaptions(
      [{ start: 5, end: 6, text: 'caption only' }],
      [{ start: 8, end: 8.4, text: 'outside' }],
    )

    expect(out[0]).toEqual({ start: 5, end: 6, text: 'caption only' })
  })
})
