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

varying vec2 v_uv;

uniform sampler2D u_board;
uniform vec4 u_boardRect;
uniform vec2 u_resolution;
uniform float u_waterY;
uniform float u_time;
uniform float u_flash;
uniform vec4 u_boardBg;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

vec2 waterDisplacement(vec2 px, float depth) {
  float t = u_time;

  float dx = 0.0;
  dx += sin(px.y * 0.045 + t * 1.7) * 6.0;
  dx += sin(px.y * 0.012 - t * 1.1 + px.x * 0.004) * 4.5;
  dx += sin(px.y * 0.09 + t * 3.1 + px.x * 0.02) * 2.2;
  dx += (vnoise(vec2(px.x * 0.012, px.y * 0.02 + t * 0.6)) - 0.5) * 8.0;

  float dy = 0.0;
  dy += sin(px.x * 0.03 + t * 1.4) * 1.6;
  dy += (vnoise(vec2(px.x * 0.02 - t * 0.4, px.y * 0.03)) - 0.5) * 3.0;

  float depthFactor = clamp(depth / 80.0, 0.25, 1.4);
  return vec2(dx, dy) * depthFactor;
}

float surfaceShimmer(vec2 px) {
  float t = u_time;
  float n1 = vnoise(vec2(px.x * 0.05 - t * 0.7, px.y * 0.08 + t * 0.5));
  float n2 = vnoise(vec2(px.x * 0.12 + t * 1.1, px.y * 0.18 - t * 0.9));
  return n1 * 0.6 + n2 * 0.4;
}

void main() {
  vec2 px = v_uv * u_resolution;
  px.y = u_resolution.y - px.y;

  if (px.y < u_waterY) {
    discard;
  }

  float depth = px.y - u_waterY;
  vec2 mirrorPx = vec2(px.x, u_waterY - depth);

  vec2 disp = waterDisplacement(px, depth);
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

  float shimmer = surfaceShimmer(px);
  float shimmerHi = smoothstep(0.62, 0.95, shimmer) * (0.35 + edgeBand * 0.6);

  vec3 waterTint = mix(vec3(0.05, 0.08, 0.13), vec3(0.10, 0.16, 0.24), fade);
  vec3 col = mix(waterTint, reflectColor.rgb * vec3(0.85, 0.92, 1.05), fade * 0.72);
  col += vec3(0.55, 0.7, 0.95) * edgeBand;
  col += vec3(0.75, 0.85, 1.0) * shimmerHi;
  col += vec3(0.7, 0.78, 0.95) * u_flash * 0.35 * fade;

  float alpha = 0.55 + fade * 0.4;
  gl_FragColor = vec4(col, alpha);
}
`;

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

  render(timeSeconds: number): void {
    const gl = this.gl;
    if (!this.boardCanvas || !this.getBoardRect) {
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      return;
    }

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
    // Match #canvas CSS background (#11141d) so off-board reflection samples the board frame color
    gl.uniform4f(this.uLoc['u_boardBg']!, 0x11 / 255, 0x14 / 255, 0x1d / 255, 1.0);

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
