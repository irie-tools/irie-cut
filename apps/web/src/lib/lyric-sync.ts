// Re-time known lyric lines (e.g. from Pam) onto audio-accurate word timings
// (from Whisper). Keeps the WORDS exactly as written — only the timing comes from
// the audio, so the lag dies and we get per-word times for karaoke. Pure + tested.

export interface TimedWord {
  start: number
  end: number
  text: string
}

export interface SyncedLine {
  start: number
  end: number
  text: string
  /** Per-word timing, song-absolute seconds. Powers karaoke highlighting. */
  words: TimedWord[]
}

function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9']/g, '')
}

/** Match two normalized tokens: equal, or a shared prefix of ≥3 chars (Whisper near-misses). */
function tokenMatch(a: string, b: string): boolean {
  if (!a || !b) return false
  if (a === b) return true
  const n = Math.min(a.length, b.length)
  return n >= 3 && a.slice(0, n) === b.slice(0, n)
}

/** First index in [from, from+window) whose word matches `target`; -1 if none. */
function findWord(words: { n: string }[], from: number, target: string, window = 14): number {
  const end = Math.min(words.length, from + window)
  for (let i = Math.max(0, from); i < end; i++) if (tokenMatch(words[i].n, target)) return i
  return -1
}

/** Split a line into display words (original casing/punctuation kept). */
function splitWords(text: string): string[] {
  return text.split(/\s+/).filter((w) => w.trim().length > 0)
}

/** Distribute a line's words across [start, end], weighted by length → per-word times. */
export function distributeWords(words: string[], start: number, end: number): TimedWord[] {
  if (!words.length) return []
  const lens = words.map((w) => Math.max(1, w.replace(/[^a-z0-9]/gi, '').length))
  const total = lens.reduce((a, c) => a + c, 0)
  const span = Math.max(0, end - start)
  let acc = 0
  return words.map((w, i) => {
    const s = start + (acc / total) * span
    acc += lens[i]
    const e = start + (acc / total) * span
    return { start: round(s), end: round(e), text: w }
  })
}

function round(n: number): number {
  return Math.round(n * 1000) / 1000
}

/**
 * Re-time `lines` (text is authoritative) using `whisperWords` (timing is
 * authoritative). For each line we find its first and last word in the audio
 * word-stream, anchor the line to those times, and spread the line's words
 * across that window. Lines whose anchors can't be found are interpolated from
 * their neighbours so nothing is dropped.
 */
export function syncLyricsToAudio(
  lines: { text: string }[],
  whisperWords: TimedWord[],
): SyncedLine[] {
  const W = whisperWords
    .filter((w) => w.text && Number.isFinite(w.start) && Number.isFinite(w.end))
    .map((w) => ({ ...w, n: norm(w.text) }))
  const clean = lines.map((l) => ({ text: l.text, words: splitWords(l.text) })).filter((l) => l.words.length)
  if (!W.length || !clean.length) {
    // Nothing to align against — hand back the lines untimed (caller can fall back).
    return clean.map((l) => ({ start: 0, end: 0, text: l.text, words: [] }))
  }

  type Anchored = { text: string; words: string[]; start: number | null; end: number | null }
  const out: Anchored[] = []
  let cursor = 0
  for (const line of clean) {
    const normWords = line.words.map(norm).filter(Boolean)
    const startIdx = findWord(W, cursor, normWords[0])
    let endIdx = -1
    if (startIdx >= 0) {
      endIdx = findWord(W, startIdx, normWords[normWords.length - 1])
      if (endIdx < startIdx) endIdx = Math.min(W.length - 1, startIdx + normWords.length - 1)
      out.push({ text: line.text, words: line.words, start: W[startIdx].start, end: W[endIdx].end })
      cursor = endIdx + 1
    } else {
      out.push({ text: line.text, words: line.words, start: null, end: null })
    }
  }

  // Interpolate any unanchored lines from the nearest anchored neighbours.
  fillGaps(out, W[0].start, W[W.length - 1].end)

  return out.map((l) => ({
    start: round(l.start ?? 0),
    end: round(l.end ?? 0),
    text: l.text,
    words: distributeWords(l.words, l.start ?? 0, l.end ?? 0),
  }))
}

/** Give every null-timed line a start/end by spreading between known anchors. */
function fillGaps(rows: { start: number | null; end: number | null }[], floor: number, ceil: number): void {
  for (let i = 0; i < rows.length; i++) {
    if (rows[i].start != null) continue
    let a = i - 1
    while (a >= 0 && rows[a].end == null) a--
    let b = i + 1
    while (b < rows.length && rows[b].start == null) b++
    const from = a >= 0 ? (rows[a].end as number) : floor
    const to = b < rows.length ? (rows[b].start as number) : ceil
    const gapCount = b - a // number of slots between the two anchors
    const slot = (to - from) / Math.max(1, gapCount)
    const k = i - a
    rows[i].start = from + slot * (k - 1)
    rows[i].end = from + slot * k
  }
}
