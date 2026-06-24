// Per-clip Web Audio effects chain (Phase 4.4): 3-band EQ, high-pass (voice
// cleanup), compressor, and reverb. The SAME chain is used by the live preview
// and the exporter so what you hear matches what renders. Build once, then
// `update()` the node params from the clip's `audioFx` (params are static, not
// keyframed). Returns null when the effects are neutral (caller bypasses).

export interface AudioFx {
  /** Low-shelf gain, dB (−12..+12). */
  eqLow: number
  /** Mid peaking gain, dB. */
  eqMid: number
  /** High-shelf gain, dB. */
  eqHigh: number
  /** Compressor amount 0..1 (0 = off). */
  compressor: number
  /** Reverb wet amount 0..1 (0 = dry). */
  reverb: number
  /** High-pass amount 0..1 (0 = off → rumble/low-end removal). */
  highpass: number
}

export const DEFAULT_FX: AudioFx = { eqLow: 0, eqMid: 0, eqHigh: 0, compressor: 0, reverb: 0, highpass: 0 }

const EPS = 1e-3

export function isNeutralFx(fx: Partial<AudioFx> | undefined): boolean {
  if (!fx) return true
  return (
    Math.abs(fx.eqLow ?? 0) < EPS &&
    Math.abs(fx.eqMid ?? 0) < EPS &&
    Math.abs(fx.eqHigh ?? 0) < EPS &&
    Math.abs(fx.compressor ?? 0) < EPS &&
    Math.abs(fx.reverb ?? 0) < EPS &&
    Math.abs(fx.highpass ?? 0) < EPS
  )
}

export interface FxChain {
  input: AudioNode
  output: AudioNode
  update: (fx: AudioFx) => void
}

/** highpass amount 0..1 → cutoff frequency (Hz). 0 ≈ inaudible (off). */
function highpassHz(amount: number): number {
  return 20 + Math.max(0, Math.min(1, amount)) * 380 // 20..400 Hz
}

const impulseCache = new WeakMap<BaseAudioContext, AudioBuffer>()
function reverbImpulse(ctx: BaseAudioContext): AudioBuffer {
  const cached = impulseCache.get(ctx)
  if (cached) return cached
  const seconds = 2.2
  const rate = ctx.sampleRate
  const len = Math.floor(rate * seconds)
  const buf = ctx.createBuffer(2, len, rate)
  for (let ch = 0; ch < 2; ch++) {
    const data = buf.getChannelData(ch)
    for (let i = 0; i < len; i++) {
      // decaying noise tail
      const decay = Math.pow(1 - i / len, 2.5)
      data[i] = (Math.sin(i * (ch === 0 ? 12.9898 : 78.233)) * 43758.5453 % 1) // pseudo-noise, deterministic
      data[i] = (data[i] - Math.floor(data[i]) - 0.5) * 2 * decay
    }
  }
  impulseCache.set(ctx, buf)
  return buf
}

/** Build the effect chain. Always present (full topology); `update` sets values. */
export function buildFxChain(ctx: BaseAudioContext, fx: AudioFx): FxChain {
  const input = ctx.createGain()
  const output = ctx.createGain()
  const hp = ctx.createBiquadFilter()
  hp.type = 'highpass'
  const low = ctx.createBiquadFilter()
  low.type = 'lowshelf'
  low.frequency.value = 220
  const mid = ctx.createBiquadFilter()
  mid.type = 'peaking'
  mid.frequency.value = 1200
  mid.Q.value = 1
  const high = ctx.createBiquadFilter()
  high.type = 'highshelf'
  high.frequency.value = 4500
  const comp = ctx.createDynamicsCompressor()
  const dry = ctx.createGain()
  const wet = ctx.createGain()
  const conv = ctx.createConvolver()
  conv.buffer = reverbImpulse(ctx)

  // input → hp → low → mid → high → comp → { dry → output, conv → wet → output }
  input.connect(hp)
  hp.connect(low)
  low.connect(mid)
  mid.connect(high)
  high.connect(comp)
  comp.connect(dry)
  dry.connect(output)
  comp.connect(conv)
  conv.connect(wet)
  wet.connect(output)

  const update = (f: AudioFx) => {
    hp.frequency.value = highpassHz(f.highpass)
    low.gain.value = f.eqLow
    mid.gain.value = f.eqMid
    high.gain.value = f.eqHigh
    // Compressor: amount 0..1 → harder threshold + higher ratio.
    const c = Math.max(0, Math.min(1, f.compressor))
    comp.threshold.value = -10 - c * 35 // -10..-45 dB
    comp.ratio.value = 1 + c * 11 // 1..12
    comp.knee.value = 30
    comp.attack.value = 0.003
    comp.release.value = 0.25
    // Reverb wet/dry.
    const w = Math.max(0, Math.min(1, f.reverb))
    wet.gain.value = w
    dry.gain.value = 1 - w * 0.4
  }
  update(fx)
  return { input, output, update }
}
