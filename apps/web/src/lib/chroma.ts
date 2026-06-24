// Chroma key (green-screen) removal via a WebGL pass (Phase 2.4).
//
// Canvas2D `drawImage` can't do per-pixel keying, so a clip flagged with
// `chroma` is first rendered through a fragment shader that keys out the target
// colour (YCbCr chroma distance) with similarity/smoothness controls and spill
// suppression. The shader writes straight-alpha pixels into an offscreen canvas,
// which the shared renderer then composites like any other source — so transform,
// blend, mask, and EXPORT all work unchanged (preview == export).
//
// The GL context + program + textures are singletons reused across frames.

export interface ChromaParams {
  /** Key colour as a CSS hex string, e.g. '#00ff00'. */
  color: string
  /** 0..1 — how close a pixel's chroma must be to the key to start keying. */
  similarity: number
  /** 0..1 — soft edge width beyond `similarity`. */
  smoothness: number
  /** 0..1 — how strongly to desaturate (suppress) key-colour spill on edges. */
  spill: number
}

export const DEFAULT_CHROMA: ChromaParams = {
  color: '#00d000',
  similarity: 0.4,
  smoothness: 0.1,
  spill: 0.1,
}

const VERT = `
attribute vec2 a_pos;
varying vec2 v_uv;
void main() {
  v_uv = vec2(a_pos.x * 0.5 + 0.5, a_pos.y * 0.5 + 0.5);
  gl_Position = vec4(a_pos, 0.0, 1.0);
}`

const FRAG = `
precision mediump float;
uniform sampler2D u_tex;
uniform vec3 u_key;
uniform float u_similarity;
uniform float u_smoothness;
uniform float u_spill;
varying vec2 v_uv;

vec2 rgb2uv(vec3 c) {
  return vec2(
    -0.169 * c.r - 0.331 * c.g + 0.5 * c.b,
     0.5 * c.r - 0.419 * c.g - 0.081 * c.b
  );
}

void main() {
  vec4 tex = texture2D(u_tex, v_uv);
  vec2 kuv = rgb2uv(u_key);
  vec2 puv = rgb2uv(tex.rgb);
  float dist = distance(puv, kuv);
  // alpha 0 near the key colour, 1 once chroma distance clears similarity+smoothness
  float alpha = smoothstep(u_similarity, u_similarity + u_smoothness + 1e-4, dist);
  // spill suppression: pull greenish edge pixels toward their luma
  float spillFactor = clamp(1.0 - dist / (u_similarity + 1e-4), 0.0, 1.0) * u_spill;
  float luma = dot(tex.rgb, vec3(0.2126, 0.7152, 0.0722));
  vec3 rgb = mix(tex.rgb, vec3(luma), spillFactor);
  gl_FragColor = vec4(rgb, tex.a * alpha);
}`

interface GLState {
  canvas: HTMLCanvasElement
  gl: WebGLRenderingContext
  program: WebGLProgram
  tex: WebGLTexture
  loc: {
    key: WebGLUniformLocation | null
    similarity: WebGLUniformLocation | null
    smoothness: WebGLUniformLocation | null
    spill: WebGLUniformLocation | null
    tex: WebGLUniformLocation | null
  }
}

let state: GLState | null = null
/** True if WebGL initialised and we should attempt keying; false → caller falls back to the raw source. */
let glAvailable = true

function compile(gl: WebGLRenderingContext, type: number, src: string): WebGLShader | null {
  const sh = gl.createShader(type)
  if (!sh) return null
  gl.shaderSource(sh, src)
  gl.compileShader(sh)
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    gl.deleteShader(sh)
    return null
  }
  return sh
}

function init(): GLState | null {
  if (state) return state
  if (!glAvailable || typeof document === 'undefined') return null
  const canvas = document.createElement('canvas')
  const gl = canvas.getContext('webgl', { premultipliedAlpha: false, alpha: true }) as WebGLRenderingContext | null
  if (!gl) {
    glAvailable = false
    return null
  }
  const vs = compile(gl, gl.VERTEX_SHADER, VERT)
  const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG)
  const program = gl.createProgram()
  if (!vs || !fs || !program) {
    glAvailable = false
    return null
  }
  gl.attachShader(program, vs)
  gl.attachShader(program, fs)
  gl.bindAttribLocation(program, 0, 'a_pos')
  gl.linkProgram(program)
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    glAvailable = false
    return null
  }
  gl.useProgram(program)

  const buf = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, buf)
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW)
  gl.enableVertexAttribArray(0)
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0)

  const tex = gl.createTexture()!
  gl.bindTexture(gl.TEXTURE_2D, tex)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1)
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, 0)

  state = {
    canvas,
    gl,
    program,
    tex,
    loc: {
      key: gl.getUniformLocation(program, 'u_key'),
      similarity: gl.getUniformLocation(program, 'u_similarity'),
      smoothness: gl.getUniformLocation(program, 'u_smoothness'),
      spill: gl.getUniformLocation(program, 'u_spill'),
      tex: gl.getUniformLocation(program, 'u_tex'),
    },
  }
  return state
}

/** Parse '#rrggbb' (or '#rgb') to normalized [r,g,b] in 0..1. */
export function hexToRgb01(hex: string): [number, number, number] {
  let h = hex.replace('#', '').trim()
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2]
  const n = parseInt(h || '000000', 16)
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]
}

/**
 * Key the source through the chroma shader and return an offscreen canvas of
 * size `w x h` with the key colour made transparent. Returns `null` if WebGL is
 * unavailable (caller should fall back to drawing the raw source).
 */
export function chromaKey(
  source: CanvasImageSource,
  w: number,
  h: number,
  params: ChromaParams,
): HTMLCanvasElement | null {
  const st = init()
  if (!st || w <= 0 || h <= 0) return null
  const { gl, canvas, loc } = st
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w
    canvas.height = h
  }
  gl.viewport(0, 0, w, h)
  gl.bindTexture(gl.TEXTURE_2D, st.tex)
  try {
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source as TexImageSource)
  } catch {
    return null
  }
  const [r, g, b] = hexToRgb01(params.color)
  gl.uniform3f(loc.key, r, g, b)
  gl.uniform1f(loc.similarity, Math.max(0.001, params.similarity))
  gl.uniform1f(loc.smoothness, Math.max(0, params.smoothness))
  gl.uniform1f(loc.spill, Math.max(0, Math.min(1, params.spill)))
  gl.uniform1i(loc.tex, 0)
  gl.clearColor(0, 0, 0, 0)
  gl.clear(gl.COLOR_BUFFER_BIT)
  gl.drawArrays(gl.TRIANGLES, 0, 6)
  return canvas
}
