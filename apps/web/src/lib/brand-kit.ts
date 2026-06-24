// Shared brand kit (Phase 7 — thin ecosystem hook). A small, local, optional
// store of brand colours + a brand font that any project can apply to its text.
// Deliberately minimal: an integration point, not a feature Irie Cut owns.

export interface BrandKit {
  colors: string[]
  fontFamily?: string
}

const KEY = 'irie-cut-brand-kit'

const DEFAULT_KIT: BrandKit = {
  colors: ['#22d3ee', '#ffffff', '#0b1220'],
  fontFamily: undefined,
}

export function getBrandKit(): BrandKit {
  if (typeof localStorage === 'undefined') return { ...DEFAULT_KIT }
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return { ...DEFAULT_KIT }
    const parsed = JSON.parse(raw) as BrandKit
    return { colors: Array.isArray(parsed.colors) ? parsed.colors.slice(0, 12) : DEFAULT_KIT.colors, fontFamily: parsed.fontFamily }
  } catch {
    return { ...DEFAULT_KIT }
  }
}

export function saveBrandKit(kit: BrandKit): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(KEY, JSON.stringify({ colors: kit.colors.slice(0, 12), fontFamily: kit.fontFamily }))
  } catch {
    /* storage full / unavailable */
  }
}

export function addBrandColor(color: string): BrandKit {
  const kit = getBrandKit()
  if (!kit.colors.includes(color)) kit.colors = [color, ...kit.colors].slice(0, 12)
  saveBrandKit(kit)
  return kit
}

export function removeBrandColor(color: string): BrandKit {
  const kit = getBrandKit()
  kit.colors = kit.colors.filter((c) => c !== color)
  saveBrandKit(kit)
  return kit
}

export function setBrandFont(fontFamily: string | undefined): BrandKit {
  const kit = getBrandKit()
  kit.fontFamily = fontFamily
  saveBrandKit(kit)
  return kit
}
