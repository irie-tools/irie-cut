export interface TimedText {
  start: number
  end: number
  text: string
}

export interface CaptionWithWords extends TimedText {
  words?: TimedText[]
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000
}

/**
 * Attach Whisper word timings to line/phrase captions.
 *
 * Both inputs are source-local seconds. Output word times are caption-local
 * seconds, which matches TextProperties.words and the shared renderer.
 */
export function attachWordsToCaptions(cues: TimedText[], words: TimedText[]): CaptionWithWords[] {
  if (!words.length) return cues.map((c) => ({ ...c }))
  return cues.map((cue) => {
    const start = Math.max(0, cue.start)
    const end = Math.max(start, cue.end || cue.start)
    const localWords = words
      .filter((w) => {
        const mid = (w.start + w.end) / 2
        return mid >= start - 0.05 && mid <= end + 0.05
      })
      .map((w) => ({
        start: round3(Math.max(0, w.start - start)),
        end: round3(Math.max(0, w.end - start)),
        text: w.text,
      }))
      .filter((w) => w.text.trim().length > 0 && w.end >= w.start)

    return localWords.length ? { ...cue, words: localWords } : { ...cue }
  })
}
