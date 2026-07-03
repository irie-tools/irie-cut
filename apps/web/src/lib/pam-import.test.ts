import { describe, expect, it } from 'vitest'
import { resolveRelativePath } from './pam-import'

describe('resolveRelativePath', () => {
  it('resolves Pam album packet paths from the handoffs folder', () => {
    expect(resolveRelativePath('YouTube Album Release - Harbor Light/handoffs', '../tracks/01 - Open Water/audio.mp3'))
      .toBe('YouTube Album Release - Harbor Light/tracks/01 - Open Water/audio.mp3')
  })

  it('normalizes duplicate separators and current-directory segments', () => {
    expect(resolveRelativePath('release/handoffs/', './../album//album_tags.txt')).toBe('release/album/album_tags.txt')
  })
})
