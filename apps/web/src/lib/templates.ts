// Format templates: one-click presets that set the canvas size and drop in a
// ratio-aware starter layout (title / CTA text). Ported from the media studio's
// applyStarterRecipe, adapted to Irie Cut's clip model.

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
