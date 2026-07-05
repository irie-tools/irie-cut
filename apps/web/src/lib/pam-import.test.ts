import { describe, expect, it } from 'vitest'
import {
  analyzePamAlbumImport,
  getMusicVideoFormula,
  MUSIC_VIDEO_FORMULAS,
  optionsFromMusicVideoFormula,
  resolveRelativePath,
} from './pam-import'

function folderFile(path: string, content: string, type = 'text/plain'): File {
  const file = new File([content], path.split('/').pop() || 'file', { type })
  Object.defineProperty(file, 'webkitRelativePath', { value: path })
  return file
}

describe('resolveRelativePath', () => {
  it('resolves Pam album packet paths from the handoffs folder', () => {
    expect(resolveRelativePath('YouTube Album Release - Harbor Light/handoffs', '../tracks/01 - Open Water/audio.mp3'))
      .toBe('YouTube Album Release - Harbor Light/tracks/01 - Open Water/audio.mp3')
  })

  it('normalizes duplicate separators and current-directory segments', () => {
    expect(resolveRelativePath('release/handoffs/', './../album//album_tags.txt')).toBe('release/album/album_tags.txt')
  })
})

describe('analyzePamAlbumImport', () => {
  it('preflights found media, generated captions, chapters, and missing video replacements', async () => {
    const packet = {
      iriePromo: 2,
      source: 'pam',
      kind: 'youtube_album_release',
      title: 'Harbor Light',
      artist: 'Irie',
      albumTitle: 'Harbor Light',
      chapters: [{ at: 0, label: 'Open Water' }],
      timeline: [{
        trackNo: 1,
        title: 'Open Water',
        startSec: 0,
        durationSec: 12,
        audioPath: '../tracks/01/audio.mp3',
        lyricsPath: '../tracks/01/lyrics.txt',
        existingVideoPath: '../tracks/01/video.mp4',
      }],
    }
    const result = await analyzePamAlbumImport([
      folderFile('release/handoffs/irie_cut_album.iriepromo.json', JSON.stringify(packet), 'application/json'),
      folderFile('release/tracks/01/audio.mp3', 'audio', 'audio/mpeg'),
      folderFile('release/tracks/01/lyrics.txt', '[00:00.00]One\n[00:06.00]Two'),
    ])

    expect(result.trackCount).toBe(1)
    expect(result.chapterCount).toBe(1)
    expect(result.totals.audioFound).toBe(1)
    expect(result.totals.captions).toBe(2)
    expect(result.tracks[0].missing).toEqual(['video'])
  })
})

describe('music video formulas', () => {
  it('provides reusable formula defaults for Pam album assembly', () => {
    expect(MUSIC_VIDEO_FORMULAS.length).toBeGreaterThanOrEqual(8)
    const formula = getMusicVideoFormula('cinematic-rnb')
    const options = optionsFromMusicVideoFormula('cinematic-rnb')

    expect(formula.name).toBe('Cinematic R&B')
    expect(options).toMatchObject({
      formulaId: 'cinematic-rnb',
      visualPreset: 'cinematic',
      captionStrategy: 'lyrics',
    })
    expect(options.exportTargets).toContain('youtube-16x9')
    expect(options.prepActions).toContain('stabilize')
  })
})
