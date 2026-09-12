/**
 * Two renderers for the same picture.
 *
 * The shader is the one that matters: it evaluates every cell every frame,
 * which is what lets the field carry motion of its own rather than only
 * cross-fading. Water has to flow, grain has to settle, and both are per-cell
 * per-frame work that JavaScript cannot do at sixty frames on a phone at this
 * density.
 *
 * The 2D renderer exists because a backdrop that fails to a blank rectangle is
 * worse than a plain page. It blends and dithers the same fields at a coarser
 * grid and without the motion, on a machine with no WebGL2.
 *
 * Neither one is a library. The shader is forty lines of GLSL and the setup
 * around it is a few dozen more, so the whole backdrop costs less than most
 * sites spend on a font.
 */

import { SCENE_COUNT, type Size } from './scenes';

/** Ordered dither, 8 by 8, grid-locked to match the page's hairline grid. */
export const BAYER = [
  0, 32, 8, 40, 2, 34, 10, 42, 48, 16, 56, 24, 50, 18, 58, 26, 12, 44, 4, 36, 14, 46, 6, 38, 60, 28,
  52, 20, 62, 30, 54, 22, 3, 35, 11, 43, 1, 33, 9, 41, 51, 19, 59, 27, 49, 17, 57, 25, 15, 47, 7,
  39, 13, 45, 5, 37, 63, 31, 55, 23, 61, 29, 53, 21,
];

export interface Frame {
  /** Index of the field being left. */
  from: number;
  /** Index of the field being arrived at. */
  to: number;
  /** How far between them, 0 to 1. */
  mix: number;
  /** How much disorder to inject. Peaks halfway through a pair's dissolve. */
  churn: number;
  /** Seconds since mount, for the motion that belongs to a field itself. */
  time: number;
  /** Ink and ground, straight from the theme. */
  ink: [number, number, number];
  ground: [number, number, number];
}

export interface Renderer {
  resize: (size: Size, fields: Uint8Array) => void;
  draw: (frame: Frame) => void;
  destroy: () => void;
  readonly kind: 'webgl2' | 'canvas2d';
}

// ----------------------------------------------------------------- shader

const VERTEX = `#version 300 es
in vec2 position;
void main() { gl_Position = vec4(position, 0.0, 1.0); }`;

const FRAGMENT = `#version 300 es
precision highp float;
precision highp sampler2DArray;

uniform sampler2DArray uFields;
uniform vec2  uGrid;
uniform float uFrom;
uniform float uTo;
uniform float uMix;
uniform float uChurn;
uniform float uTime;
uniform vec3  uInk;
uniform vec3  uGround;
uniform float uBayer[64];

out vec4 fragColour;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

/* Value noise, two octaves. Enough for drift, cheap enough for every cell. */
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
    mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x),
    f.y);
}

void main() {
  vec2 cell = floor(gl_FragCoord.xy);
  /*
   * Flipped on the vertical.
   *
   * gl_FragCoord counts up from the bottom of the viewport, and the fields are
   * uploaded straight from canvas image data, which counts down from the top.
   * Without this every composition renders upside down, which is subtle enough
   * on a field of dots to look like nothing at all: the canopy landed below
   * the mask and the backdrop appeared empty.
   */
  vec2 uv = vec2(cell.x + 0.5, uGrid.y - cell.y - 0.5) / uGrid;

  /*
   * Motion that belongs to the fields themselves rather than to the blend.
   * Water drifts along its course, grain settles downward, and the built
   * fields hold still, because a rack that shimmers reads as a mistake.
   */
  float organic = 1.0 - abs(uMix - 0.5) * 2.0;
  vec2 drift = vec2(uTime * 0.012, sin(uTime * 0.35 + uv.y * 9.0) * 0.0035);
  vec2 warped = uv + drift * (0.35 + organic * 0.65);

  float a = texture(uFields, vec3(warped, uFrom)).r;
  float b = texture(uFields, vec3(uv, uTo)).r;
  float field = mix(a, b, uMix);

  /*
   * Disorder, peaking in the middle of a dissolve. This is the dither state
   * itself: the point where the picture is only noise, and the reason the two
   * ends read as two readings of one grid.
   */
  float grain = noise(cell * 0.11 + uTime * 0.25);
  field += (grain - 0.42) * uChurn * 0.9;

  int index = int(mod(cell.y, 8.0)) * 8 + int(mod(cell.x, 8.0));
  float threshold = (uBayer[index] + 0.5) / 64.0;

  float on = step(threshold, field);
  fragColour = vec4(mix(uGround, uInk, on) / 255.0, on);
}`;

const compile = (gl: WebGL2RenderingContext, type: number, source: string): WebGLShader | null => {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    // eslint-disable-next-line no-console
    console.error('dither shader', gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }
  return shader;
};

const shaderRenderer = (canvas: HTMLCanvasElement): Renderer | null => {
  const gl = canvas.getContext('webgl2', {
    alpha: true,
    antialias: false,
    depth: false,
    stencil: false,
    premultipliedAlpha: false,
    powerPreference: 'low-power',
  });
  if (!gl) return null;

  const vertex = compile(gl, gl.VERTEX_SHADER, VERTEX);
  const fragment = compile(gl, gl.FRAGMENT_SHADER, FRAGMENT);
  const program = gl.createProgram();
  if (!vertex || !fragment || !program) return null;

  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    // eslint-disable-next-line no-console
    console.error('dither link', gl.getProgramInfoLog(program));
    return null;
  }
  gl.useProgram(program);

  const quad = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, quad);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const position = gl.getAttribLocation(program, 'position');
  gl.enableVertexAttribArray(position);
  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D_ARRAY, texture);
  gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  const at = (name: string): WebGLUniformLocation | null => gl.getUniformLocation(program, name);
  const uniforms = {
    grid: at('uGrid'),
    from: at('uFrom'),
    to: at('uTo'),
    mix: at('uMix'),
    churn: at('uChurn'),
    time: at('uTime'),
    ink: at('uInk'),
    ground: at('uGround'),
  };

  // Some drivers name an array uniform by its first element.
  gl.uniform1fv(at('uBayer') ?? at('uBayer[0]'), new Float32Array(BAYER));
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

  let grid: Size = { width: 1, height: 1 };

  return {
    kind: 'webgl2',
    resize: (size, fields) => {
      grid = size;
      canvas.width = size.width;
      canvas.height = size.height;
      gl.viewport(0, 0, size.width, size.height);
      gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
      gl.texImage3D(
        gl.TEXTURE_2D_ARRAY,
        0,
        gl.R8,
        size.width,
        size.height,
        SCENE_COUNT,
        0,
        gl.RED,
        gl.UNSIGNED_BYTE,
        fields,
      );
      gl.uniform2f(uniforms.grid, size.width, size.height);
    },
    draw: (frame) => {
      gl.uniform1f(uniforms.from, frame.from);
      gl.uniform1f(uniforms.to, frame.to);
      gl.uniform1f(uniforms.mix, frame.mix);
      gl.uniform1f(uniforms.churn, frame.churn);
      gl.uniform1f(uniforms.time, frame.time);
      gl.uniform3f(uniforms.ink, frame.ink[0], frame.ink[1], frame.ink[2]);
      gl.uniform3f(uniforms.ground, frame.ground[0], frame.ground[1], frame.ground[2]);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      void grid;
    },
    destroy: () => {
      gl.deleteProgram(program);
      gl.deleteBuffer(quad);
      gl.deleteTexture(texture);
    },
  };
};

// ----------------------------------------------------------------- canvas

const canvasRenderer = (canvas: HTMLCanvasElement): Renderer | null => {
  const context = canvas.getContext('2d');
  if (!context) return null;

  let grid: Size = { width: 1, height: 1 };
  // Annotated: the buffer type inferred from the constructor is narrower than
  // the one the caller hands over, and the two will not assign.
  let fields: Uint8Array<ArrayBufferLike> = new Uint8Array(0);
  let image: ImageData | null = null;

  return {
    kind: 'canvas2d',
    resize: (size, next) => {
      grid = size;
      fields = next;
      canvas.width = size.width;
      canvas.height = size.height;
      image = context.createImageData(size.width, size.height);
    },
    draw: (frame) => {
      if (!image) return;
      const { width, height } = grid;
      const cells = width * height;
      const from = frame.from * cells;
      const to = frame.to * cells;
      const pixels = image.data;

      for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
          const i = y * width + x;
          const a = (fields[from + i] ?? 0) / 255;
          const b = (fields[to + i] ?? 0) / 255;
          let value = a * (1 - frame.mix) + b * frame.mix;

          const scatter =
            ((Math.imul(x + 1, 374761393) ^ Math.imul(y + 1, 668265263)) >>> 8) / 65536;
          value += ((scatter % 1) - 0.42) * frame.churn * 0.9;

          const threshold = (((BAYER[(y & 7) * 8 + (x & 7)] ?? 32) + 0.5) / 64);
          const on = value > threshold;
          const colour = on ? frame.ink : frame.ground;
          const at = i * 4;
          pixels[at] = colour[0];
          pixels[at + 1] = colour[1];
          pixels[at + 2] = colour[2];
          pixels[at + 3] = on ? 255 : 0;
        }
      }
      context.putImageData(image, 0, 0);
    },
    destroy: () => {},
  };
};

export const createRenderer = (canvas: HTMLCanvasElement): Renderer | null =>
  shaderRenderer(canvas) ?? canvasRenderer(canvas);
