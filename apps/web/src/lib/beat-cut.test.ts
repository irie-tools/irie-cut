import { describe, it, expect } from 'vitest'
import { planBeatCut, kenBurnsKeyframes, clipsFromSegments, sequentialClips } from './beat-cut'

describe('planBeatCut', () => {
  it('cuts every K beats and cycles sources, last segment reaches songDuration', () => {
    const segs = planBeatCut({ beats: [1, 2, 3, 4, 5, 6, 7, 8], songDuration: 9, sourceCount: 3, k: 2 })
    expect(segs.map((s) => s.sourceIndex)).toEqual([0, 1, 2, 0, 1])
    expect(segs[0]).toEqual({ sourceIndex: 0, start: 0, duration: 1 })
    const last = segs[segs.length - 1]
    expect(last.start + last.duration).toBeCloseTo(9)
  })

  it('falls back to an even split when there are no usable beats', () => {
    const segs = planBeatCut({ beats: [], songDuration: 6, sourceCount: 3, k: 2 })
    expect(segs.length).toBe(3)
    expect(segs.map((s) => s.sourceIndex)).toEqual([0, 1, 2])
    expect(segs[2].start + segs[2].duration).toBeCloseTo(6)
  })

  it('larger K yields fewer cuts', () => {
    const k2 = planBeatCut({ beats: [1, 2, 3, 4, 5, 6, 7, 8], songDuration: 9, sourceCount: 2, k: 2 }).length
    const k4 = planBeatCut({ beats: [1, 2, 3, 4, 5, 6, 7, 8], songDuration: 9, sourceCount: 2, k: 4 }).length
    expect(k4).toBeLessThan(k2)
  })

  it('drops cut points that would make a sub-minimum segment', () => {
    const segs = planBeatCut({ beats: [0.05, 0.1, 3], songDuration: 6, sourceCount: 2, k: 1, minSegment: 0.2 })
    expect(segs.length).toBe(2)
    expect(segs[0].start).toBe(0)
    expect(segs[1].start).toBeCloseTo(3)
  })
})

describe('clipsFromSegments', () => {
  it('builds cover-fit image clips with alternating Ken-Burns drift', () => {
    const segs = planBeatCut({ beats: [1, 2, 3, 4], songDuration: 5, sourceCount: 2, k: 1 })
    let n = 0
    const clips = clipsFromSegments({
      segments: segs,
      sources: [{ mediaId: 'a', type: 'image' }, { mediaId: 'b', type: 'image' }],
      trackId: 't1',
      makeId: () => `id${n++}`,
    })
    expect(clips[0].mediaId).toBe('a')
    expect(clips[1].mediaId).toBe('b')
    expect(clips[0].fit).toBe('cover')
    expect(clips[0].type).toBe('image')
    // index 0 drifts +, index 1 drifts -
    expect(clips[0].keyframes?.x?.[1].value).toBeGreaterThan(0)
    expect(clips[1].keyframes?.x?.[1].value).toBeLessThan(0)
  })

  it('clamps a video source clip to its source duration, no Ken-Burns', () => {
    const clips = clipsFromSegments({
      segments: [{ sourceIndex: 0, start: 0, duration: 4 }],
      sources: [{ mediaId: 'v', type: 'video', sourceDuration: 2.5 }],
      trackId: 't1',
      makeId: () => 'idv',
    })
    expect(clips[0].type).toBe('video')
    expect(clips[0].trimEnd).toBeCloseTo(2.5)
    expect(clips[0].duration).toBeCloseTo(2.5)
    expect(clips[0].keyframes).toBeUndefined()
  })

  it('kenBurnsKeyframes scales 1 -> 1.08 over the duration', () => {
    const kf = kenBurnsKeyframes(3, 0)
    expect(kf.scale?.[0].value).toBe(1)
    expect(kf.scale?.[1].value).toBeCloseTo(1.08)
    expect(kf.scale?.[1].t).toBeCloseTo(3)
  })
})

describe('sequentialClips', () => {
  it('lays sources end-to-end; video uses sourceDuration with no Ken-Burns', () => {
    let n = 0
    const clips = sequentialClips({
      sources: [
        { mediaId: 'v1', type: 'video', sourceDuration: 2 },
        { mediaId: 'v2', type: 'video', sourceDuration: 1.5 },
      ],
      trackId: 't1',
      makeId: () => `id${n++}`,
    })
    expect(clips.map((c) => c.start)).toEqual([0, 2])
    expect(clips[0].duration).toBeCloseTo(2)
    expect(clips[1].duration).toBeCloseTo(1.5)
    expect(clips[0].type).toBe('video')
    expect(clips[0].keyframes).toBeUndefined()
  })

  it('image sources use stillDuration and get Ken-Burns', () => {
    const clips = sequentialClips({
      sources: [{ mediaId: 'a', type: 'image' }, { mediaId: 'b', type: 'image' }],
      trackId: 't1',
      makeId: () => 'x',
      stillDuration: 4,
    })
    expect(clips.map((c) => c.start)).toEqual([0, 4])
    expect(clips[0].duration).toBe(4)
    expect(clips[0].keyframes?.scale?.[1].value).toBeCloseTo(1.08)
  })

  it('falls back to stillDuration when a video has no known duration', () => {
    const clips = sequentialClips({
      sources: [{ mediaId: 'v', type: 'video' }],
      trackId: 't1',
      makeId: () => 'x',
      stillDuration: 3,
    })
    expect(clips[0].duration).toBe(3)
    expect(clips[0].trimEnd).toBe(3)
  })
})
