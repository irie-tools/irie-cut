// Format templates: one-click presets that set the canvas size and drop in a
// ratio-aware starter layout (title / CTA text). Ported from the media studio's
// applyStarterRecipe, adapted to Irie Cut's clip model.

import type { Project } from '#/types/editor'

export interface TextSpec {
  content: string
  /** Centre position as a fraction of the canvas, 0..1. */
  x: number
  y: number
  /** Font size as a fraction of canvas height. */
  fontSizeRatio: number
  align: 'left' | 'center' | 'right'
  bold: boolean
  start: number
  duration: number
  background?: string
}

export interface Template {
  id: string
  label: string
  description: string
  /** Aspect label for the card, e.g. "9:16". */
  ratio: string
  width: number
  height: number
  background?: string
  visualizer?: Project['visualizer']
  workflow?: Project['workflow']
  texts: TextSpec[]
}

export const TEMPLATES: Template[] = [
  {
    id: 'ugc-reel',
    label: 'UGC Reel',
    description: 'Vertical hook + CTA',
    ratio: '9:16',
    width: 1080,
    height: 1920,
    texts: [
      { content: 'Your hook goes here', x: 0.5, y: 0.16, fontSizeRatio: 0.055, align: 'center', bold: true, start: 0, duration: 4, background: '#000000' },
      { content: 'Follow for more', x: 0.5, y: 0.88, fontSizeRatio: 0.035, align: 'center', bold: true, start: 0, duration: 4 },
    ],
  },
  {
    id: 'square-promo',
    label: 'Square Promo',
    description: 'Centered headline',
    ratio: '1:1',
    width: 1080,
    height: 1080,
    texts: [
      { content: 'Big headline', x: 0.5, y: 0.5, fontSizeRatio: 0.09, align: 'center', bold: true, start: 0, duration: 4 },
    ],
  },
  {
    id: 'widescreen-title',
    label: 'Widescreen',
    description: 'Lower-third title',
    ratio: '16:9',
    width: 1920,
    height: 1080,
    texts: [
      { content: 'Lower third title', x: 0.28, y: 0.82, fontSizeRatio: 0.06, align: 'left', bold: true, start: 0, duration: 4, background: '#000000' },
    ],
  },
  {
    id: 'youtube-music-video',
    label: 'YouTube Music Video',
    description: '16:9 music channel pack',
    ratio: '16:9',
    width: 1920,
    height: 1080,
    background: '#050505',
    visualizer: { enabled: true, color: '#f2ede4', bassColor: '#ff5236', bassReactive: true, bassCenter: true, y: 0.9 },
    workflow: { kind: 'youtube-music-video', source: 'template' },
    texts: [
      { content: 'Tropical Chill Vol. 01', x: 0.5, y: 0.14, fontSizeRatio: 0.064, align: 'center', bold: true, start: 0, duration: 8 },
      { content: '1 Hour Mix', x: 0.5, y: 0.86, fontSizeRatio: 0.038, align: 'center', bold: true, start: 0, duration: 8, background: '#000000' },
    ],
  },
  {
    id: 'vertical-quote',
    label: 'Vertical Quote',
    description: 'Centered statement',
    ratio: '9:16',
    width: 1080,
    height: 1920,
    texts: [
      { content: '"The quote that\nstops the scroll."', x: 0.5, y: 0.5, fontSizeRatio: 0.06, align: 'center', bold: true, start: 0, duration: 5 },
    ],
  },
]
