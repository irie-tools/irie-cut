import { describe, it, expect } from 'vitest'
import { syncLyricsToAudio, distributeWords } from './lyric-sync'

const w = (text: string, start: number, end: number) => ({ text, start, end })

describe('syncLyricsToAudio', () => {
  it('keeps the written lyrics but takes timing from the audio', () => {
    const lines = [{ text: 'Hello world,' }, { text: 'Good night.' }]
    const words = [w('hello', 1.0, 1.4), w('world', 1.5, 2.0), w('good', 3.0, 3.4), w('night', 3.5, 4.0)]
    const out = syncLyricsToAudio(lines, words)
    expect(out.map((l) => l.text)).toEqual(['Hello world,', 'Good night.'])
    expect(out[0].start).toBeCloseTo(1.0)
    expect(out[0].end).toBeCloseTo(2.0)
    expect(out[1].start).toBeCloseTo(3.0)
    expect(out[1].end).toBeCloseTo(4.0)
  })

  it('produces per-word karaoke timing inside each line', () => {
    const out = syncLyricsToAudio([{ text: 'hello world' }], [w('hello', 1, 1.4), w('world', 1.5, 2)])
    expect(out[0].words.map((x) => x.text)).toEqual(['hello', 'world'])
    expect(out[0].words[0].start).toBeCloseTo(1.0)
    expect(out[0].words[1].end).toBeCloseTo(2.0)
    expect(out[0].words[0].end).toBeLessThan(out[0].words[1].start + 1e-6)
  })

  it('tolerates extra/misheard words in the audio stream', () => {
    // Whisper inserted "uh" and misheard "world" as "worlds".
    const words = [w('hello', 1, 1.4), w('uh', 1.45, 1.5), w('worlds', 1.6, 2.1)]
    const out = syncLyricsToAudio([{ text: 'Hello world' }], words)
    expect(out[0].start).toBeCloseTo(1.0)
    expect(out[0].end).toBeCloseTo(2.1)
  })

  it('interpolates a line whose words are not found in the audio', () => {
    const lines = [{ text: 'alpha' }, { text: 'zzz qqq' }, { text: 'omega' }]
    const words = [w('alpha', 1, 1.5), w('omega', 5, 5.5)]
    const out = syncLyricsToAudio(lines, words)
    expect(out[0].end).toBeCloseTo(1.5)
    expect(out[2].start).toBeCloseTo(5.0)
    // the unmatched middle line lands between its neighbours, not at 0
    expect(out[1].start).toBeGreaterThanOrEqual(1.5)
    expect(out[1].end).toBeLessThanOrEqual(5.0)
  })
})

describe('distributeWords', () => {
  it('weights longer words with more time and spans the window', () => {
    const ws = distributeWords(['a', 'longer'], 0, 7)
    expect(ws[0].start).toBe(0)
    expect(ws[ws.length - 1].end).toBeCloseTo(7)
    expect(ws[1].end - ws[1].start).toBeGreaterThan(ws[0].end - ws[0].start)
  })
})
