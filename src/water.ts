const MAX_RIPPLES = 24;
const RIPPLE_DECAY_SEC = 1.6;
const RIPPLE_LIFETIME_SEC = RIPPLE_DECAY_SEC * 1.6;
const AMBIENT_INTERVAL_MIN_SEC = 0.25;
const AMBIENT_INTERVAL_MAX_SEC = 1.35;
const AMBIENT_INITIAL_DELAY_MAX_SEC = 0.8;
const AMBIENT_STRENGTH_MIN = 0.35;
const AMBIENT_STRENGTH_MAX = 0.9;

const VERT_SRC = `
attribute vec2 a_pos;
varying vec2 v_uv;
void main() {
  v_uv = a_pos * 0.5 + 0.5;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}
`;

const FRAG_SRC = `
precision mediump float;

#define MAX_RIPPLES ${MAX_RIPPLES}

varying vec2 v_uv;

uniform sampler2D u_board;
uniform vec4 u_boardRect;
uniform vec2 u_resolution;
uniform float u_waterY;
uniform float u_time;
uniform float u_flash;
uniform vec4 u_boardBg;

// (centerX, centerY, startTime, strength); strength == 0 means inactive slot.
uniform vec4 u_ripples[MAX_RIPPLES];

const float RIPPLE_SPEED = 220.0;
const float RIPPLE_DECAY = ${RIPPLE_DECAY_SEC.toFixed(3)};
const float RIPPLE_SIGMA = 22.0;
const float RIPPLE_K = 0.32;
const float RIPPLE_AMP = 7.0;

// Returns (h, dh/dx, dh/dy) for a single ripple at sample point p in px.
// h is a radial gaussian-windowed sine packet expanding outward from the
// impact at speed RIPPLE_SPEED. The analytic gradient drives UV displacement
// without finite differences.
vec3 rippleField(vec2 p, vec4 r) {
  if (r.w <= 0.0) return vec3(0.0);
  float age = u_time - r.z;
  if (age < 0.0 || age > RIPPLE_DECAY * 1.6) return vec3(0.0);

  vec2 d = p - r.xy;
  float dist = length(d) + 1e-4;
  float frontR = RIPPLE_SPEED * age;
  float radial = dist - frontR;

  float sigma2 = RIPPLE_SIGMA * RIPPLE_SIGMA;
  float envelope = exp(-radial * radial / (2.0 * sigma2));
  float decay = exp(-age / RIPPLE_DECAY);
  float birth = smoothstep(0.0, 0.08, age);

  float phase = RIPPLE_K * radial - age * 4.5;
  float s = sin(phase);
  float c = cos(phase);

  float amp = RIPPLE_AMP * r.w * decay * birth;
  float h = amp * envelope * s;

  // d/d(radial) of [envelope*s] = envelope*c*K + s*(-radial/sigma2)*envelope.
  float dh_dr = amp * envelope * (c * RIPPLE_K - s * radial / sigma2);

  vec2 dirN = d / dist;
  vec2 grad = dh_dr * dirN;
  return vec3(h, grad.x, grad.y);
}

void main() {
  vec2 px = v_uv * u_resolution;
  px.y = u_resolution.y - px.y;

  if (px.y < u_waterY) {
    discard;
  }

  float depth = px.y - u_waterY;
  vec2 mirrorPx = vec2(px.x, u_waterY - depth);

  // Ripples live on the surface; sample them in (x, depth) plane so rings
  // visibly expand from the impact point and weaken with depth.
  vec2 sample2D = vec2(px.x, depth);

  vec3 acc = vec3(0.0);
  for (int i = 0; i < MAX_RIPPLES; i++) {
    vec4 r = u_ripples[i];
    vec4 rOnSurface = vec4(r.x, 0.0, r.z, r.w);
    acc += rippleField(sample2D, rOnSurface);
  }

  float depthFalloff = exp(-depth / 260.0);
  vec2 disp = vec2(acc.y * 18.0, acc.z * 9.0) * depthFalloff;

  mirrorPx += disp;

  vec2 boardUV = (mirrorPx - u_boardRect.xy) / u_boardRect.zw;

  vec4 reflectColor;
  if (boardUV.x >= 0.0 && boardUV.x <= 1.0 && boardUV.y >= 0.0 && boardUV.y <= 1.0) {
    reflectColor = texture2D(u_board, boardUV);
  } else {
    reflectColor = u_boardBg;
  }

  float fade = exp(-depth / 220.0);
  float edgeBand = exp(-depth / 5.0) * 0.55;

  float crestHi = max(acc.x * 0.06, 0.0);

  vec3 waterTint = mix(vec3(0.05, 0.08, 0.13), vec3(0.10, 0.16, 0.24), fade);
  vec3 col = mix(waterTint, reflectColor.rgb * vec3(0.85, 0.92, 1.05), fade * 0.72);
  col += vec3(0.55, 0.7, 0.95) * edgeBand;
  col += vec3(0.75, 0.85, 1.0) * crestHi * (0.45 + edgeBand * 0.4);
  col += vec3(0.7, 0.78, 0.95) * u_flash * 0.35 * fade;

  float alpha = 0.55 + fade * 0.4;
  gl_FragColor = vec4(col, alpha);
}
`;

interface Ripple {
  x: number;
  y: number;
  startTime: number;
  strength: number;
}

function makeInactiveRipple(): Ripple {
  return { x: 0, y: 0, startTime: -1000, strength: 0 };
}

export class Water {
  private gl: WebGLRenderingContext;
  private program: WebGLProgram;
  private texture: WebGLTexture;
  private quadBuffer: WebGLBuffer;
  private dpr = 1;
  private widthCss = 0;
  private heightCss = 0;
  private boardCanvas: HTMLCanvasElement | null = null;
  private getBoardRect: (() => DOMRect) | null = null;
  private getWaterY: () => number = () => 0;
  private getFlash: () => number = () => 0;

  private uLoc: Record<string, WebGLUniformLocation | null> = {};

  private ripples: Ripple[] = Array.from({ length: MAX_RIPPLES }, makeInactiveRipple);
  private rippleCursor = 0;
  private rippleData = new Float32Array(MAX_RIPPLES * 4);

  private nextAmbientTime: number | null = null;

  constructor(private canvas: HTMLCanvasElement) {
    const gl = canvas.getContext('webgl', { premultipliedAlpha: false, alpha: true });
    if (!gl) throw new Error('WebGL unsupported');
    this.gl = gl;

    this.program = createProgram(gl, VERT_SRC, FRAG_SRC);
    gl.useProgram(this.program);

    this.cacheUniforms();

    this.quadBuffer = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW,
    );
    const aPos = gl.getAttribLocation(this.program, 'a_pos');
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    this.texture = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    this.resize();
    window.addEventListener('resize', this.resize);
  }

  attachBoard(boardCanvas: HTMLCanvasElement, getRect: () => DOMRect): void {
    this.boardCanvas = boardCanvas;
    this.getBoardRect = getRect;
  }

  configure(opts: { getWaterY: () => number; getFlash: () => number }): void {
    this.getWaterY = opts.getWaterY;
    this.getFlash = opts.getFlash;
  }

  addRipple(x: number, y: number, strength = 1.0, timeSeconds?: number): void {
    if (strength <= 0) return;
    const t = timeSeconds ?? performance.now() / 1000;
    const slotIdx = this.pickRippleSlot(t);
    const slot = this.ripples[slotIdx]!;
    slot.x = x;
    slot.y = y;
    slot.startTime = t;
    slot.strength = strength;
    this.rippleCursor = (slotIdx + 1) % MAX_RIPPLES;
  }

  private pickRippleSlot(t: number): number {
    let oldestIdx = this.rippleCursor;
    let oldestAge = -Infinity;
    for (let i = 0; i < MAX_RIPPLES; i++) {
      const r = this.ripples[i]!;
      const age = t - r.startTime;
      if (r.strength === 0 || age >= RIPPLE_LIFETIME_SEC) return i;
      if (age > oldestAge) {
        oldestAge = age;
        oldestIdx = i;
      }
    }
    return oldestIdx;
  }

  private cacheUniforms(): void {
    const gl = this.gl;
    const names = [
      'u_board',
      'u_boardRect',
      'u_resolution',
      'u_waterY',
      'u_time',
      'u_flash',
      'u_boardBg',
      'u_ripples',
    ];
    for (const n of names) this.uLoc[n] = gl.getUniformLocation(this.program, n);
  }

  private resize = (): void => {
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.widthCss = window.innerWidth;
    this.heightCss = window.innerHeight;
    this.canvas.width = Math.floor(this.widthCss * this.dpr);
    this.canvas.height = Math.floor(this.heightCss * this.dpr);
    this.canvas.style.width = `${this.widthCss}px`;
    this.canvas.style.height = `${this.heightCss}px`;
    this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
  };

  private maybeSpawnAmbient(t: number): void {
    if (this.nextAmbientTime === null) {
      this.nextAmbientTime = t + Math.random() * AMBIENT_INITIAL_DELAY_MAX_SEC;
      return;
    }
    if (t < this.nextAmbientTime) return;
    const x = Math.random() * this.widthCss;
    const y = this.getWaterY();
    const strength =
      AMBIENT_STRENGTH_MIN + Math.random() * (AMBIENT_STRENGTH_MAX - AMBIENT_STRENGTH_MIN);
    this.addRipple(x, y, strength, t);
    const interval =
      AMBIENT_INTERVAL_MIN_SEC +
      Math.random() * (AMBIENT_INTERVAL_MAX_SEC - AMBIENT_INTERVAL_MIN_SEC);
    this.nextAmbientTime = t + interval;
  }

  private uploadRipples(t: number): void {
    const data = this.rippleData;
    for (let i = 0; i < MAX_RIPPLES; i++) {
      const r = this.ripples[i]!;
      const age = t - r.startTime;
      const active = r.strength > 0 && age >= 0 && age < RIPPLE_LIFETIME_SEC;
      const base = i * 4;
      if (active) {
        data[base] = r.x;
        data[base + 1] = r.y;
        data[base + 2] = r.startTime;
        data[base + 3] = r.strength;
      } else {
        data[base] = 0;
        data[base + 1] = 0;
        data[base + 2] = 0;
        data[base + 3] = 0;
      }
    }
    this.gl.uniform4fv(this.uLoc['u_ripples']!, data);
  }

  render(timeSeconds: number): void {
    const gl = this.gl;
    if (!this.boardCanvas || !this.getBoardRect) {
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      return;
    }

    this.maybeSpawnAmbient(timeSeconds);

    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.boardCanvas);

    const rect = this.getBoardRect();
    const waterY = this.getWaterY();
    const flash = this.getFlash();

    gl.useProgram(this.program);
    gl.uniform1i(this.uLoc['u_board']!, 0);
    gl.uniform4f(this.uLoc['u_boardRect']!, rect.left, rect.top, rect.width, rect.height);
    gl.uniform2f(this.uLoc['u_resolution']!, this.widthCss, this.heightCss);
    gl.uniform1f(this.uLoc['u_waterY']!, waterY);
    gl.uniform1f(this.uLoc['u_time']!, timeSeconds);
    gl.uniform1f(this.uLoc['u_flash']!, flash);
    // Match #canvas CSS background (#11141d) so off-board reflection samples the board frame color.
    gl.uniform4f(this.uLoc['u_boardBg']!, 0x11 / 255, 0x14 / 255, 0x1d / 255, 1.0);
    this.uploadRipples(timeSeconds);

    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }
}

function compileShader(gl: WebGLRenderingContext, type: number, src: string): WebGLShader {
  const sh = gl.createShader(type);
  if (!sh) throw new Error('createShader failed');
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    const info = gl.getShaderInfoLog(sh) ?? '';
    gl.deleteShader(sh);
    throw new Error(`Shader compile failed: ${info}`);
  }
  return sh;
}

function createProgram(gl: WebGLRenderingContext, vs: string, fs: string): WebGLProgram {
  const program = gl.createProgram();
  if (!program) throw new Error('createProgram failed');
  gl.attachShader(program, compileShader(gl, gl.VERTEX_SHADER, vs));
  gl.attachShader(program, compileShader(gl, gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const info = gl.getProgramInfoLog(program) ?? '';
    throw new Error(`Program link failed: ${info}`);
  }
  return program;
}
