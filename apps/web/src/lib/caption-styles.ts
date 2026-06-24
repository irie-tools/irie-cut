// Caption style presets (Tier 1.2). A style is a set of text-property overrides
// + an entrance animation, applied across every caption clip on a track in one
// action (store.applyCaptionStyle). Built relative to canvas height so they read
// at any aspect. Reuses the Phase 3 rich-text + keyframe-preset machinery.

import type { TextProperties } from '#/types/editor'

export interface CaptionStyle {
  id: string
  label: string
  build: (height: number) => { text: Partial<TextProperties>; preset: 'none' | 'fade' | 'pop' }
}

export const CAPTION_STYLES: CaptionStyle[] = [
  {
    id: 'pop',
    label: 'Bold Pop',
    build: (h) => ({
      preset: 'pop',
      text: {
        fontFamily: 'Bebas Neue, sans-serif', color: '#ffffff', fontSize: Math.round(h * 0.055),
        bold: true, italic: false, x: 0.5, y: 0.8, align: 'center',
        strokeColor: '#0b1220', strokeWidth: Math.max(2, Math.round(h * 0.004)),
        shadowColor: '#000000', shadowBlur: Math.round(h * 0.01), shadowOffsetY: 2,
        background: undefined, lineHeight: 1.05,
      },
    }),
  },
  {
    id: 'subtitle',
    label: 'Subtitle',
    build: (h) => ({
      preset: 'fade',
      text: {
        fontFamily: 'Inter Variable, sans-serif', color: '#ffffff', fontSize: Math.round(h * 0.035),
        bold: true, italic: false, x: 0.5, y: 0.86, align: 'center',
        background: '#000000', bgPadding: Math.round(h * 0.012), bgRadius: Math.round(h * 0.01),
        strokeColor: undefined, strokeWidth: 0, shadowColor: undefined, lineHeight: 1.2,
      },
    }),
  },
  {
    id: 'karaoke',
    label: 'Highlight',
    build: (h) => ({
      preset: 'pop',
      text: {
        fontFamily: 'Montserrat Variable, sans-serif', color: '#0b1220', fontSize: Math.round(h * 0.05),
        bold: true, italic: false, x: 0.5, y: 0.78, align: 'center',
        background: '#22d3ee', bgPadding: Math.round(h * 0.014), bgRadius: Math.round(h * 0.012),
        strokeColor: undefined, strokeWidth: 0, shadowColor: undefined, lineHeight: 1.1,
      },
    }),
  },
  {
    id: 'minimal',
    label: 'Minimal',
    build: (h) => ({
      preset: 'fade',
      text: {
        fontFamily: 'Inter Variable, sans-serif', color: '#ffffff', fontSize: Math.round(h * 0.04),
        bold: false, italic: false, x: 0.5, y: 0.5, align: 'center',
        strokeColor: undefined, strokeWidth: 0, shadowColor: '#000000', shadowBlur: Math.round(h * 0.02),
        background: undefined, lineHeight: 1.3,
      },
    }),
  },
]
