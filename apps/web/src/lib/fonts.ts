// Curated font picker (Phase 3.2). Mixes bundled @fontsource families (loaded
// offline via styles.css, so the canvas renders them reliably with no network
// and no load-race) with always-available web-safe system stacks. `value` is the
// CSS font-family written to TextProperties.fontFamily and used by the renderer.

export interface FontOption {
  label: string
  value: string
  /** True for @fontsource families bundled into the build. */
  bundled?: boolean
}

export const FONT_OPTIONS: FontOption[] = [
  // Bundled (offline) — modern editor staples.
  { label: 'Inter', value: 'Inter Variable, Inter, sans-serif', bundled: true },
  { label: 'Montserrat', value: 'Montserrat Variable, sans-serif', bundled: true },
  { label: 'Oswald', value: 'Oswald Variable, sans-serif', bundled: true },
  { label: 'Bebas Neue', value: 'Bebas Neue, sans-serif', bundled: true },
  { label: 'Anton', value: 'Anton, sans-serif', bundled: true },
  { label: 'Pacifico', value: 'Pacifico, cursive', bundled: true },
  { label: 'Playfair Display', value: 'Playfair Display, serif', bundled: true },
  // Web-safe system stacks — always available, zero network.
  { label: 'System Sans', value: 'system-ui, sans-serif' },
  { label: 'Helvetica / Arial', value: 'Helvetica, Arial, sans-serif' },
  { label: 'Georgia', value: 'Georgia, serif' },
  { label: 'Times', value: '"Times New Roman", Times, serif' },
  { label: 'Courier', value: '"Courier New", monospace' },
  { label: 'Trebuchet', value: '"Trebuchet MS", sans-serif' },
  { label: 'Impact', value: 'Impact, "Arial Black", sans-serif' },
  { label: 'Verdana', value: 'Verdana, Geneva, sans-serif' },
]

const DEFAULT_VALUE = FONT_OPTIONS[0].value

/** Map a stored fontFamily back to a known option value (for the picker), tolerating
 *  the older bare 'Inter' value. */
export function normalizeFont(family: string | undefined): string {
  if (!family) return DEFAULT_VALUE
  const match = FONT_OPTIONS.find((f) => f.value === family || f.label === family || f.value.startsWith(family))
  return match ? match.value : family
}
