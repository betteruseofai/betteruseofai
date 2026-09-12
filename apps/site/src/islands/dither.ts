/**
 * The backdrop behind the headline: a leaf becomes a die, through the dots
 * they have in common.
 *
 * Three readings of one grid. At the top of the page the cells resolve into a
 * branching, organic shape. As you scroll they fall apart into pure ordered
 * dither, which is the state where the image is only noise. Then the same
 * cells settle into orthogonal traces and pads. Nothing is drawn twice: it is
 * one field of numbers, blended from one shape to the other, thresholded
 * through a Bayer matrix.
 *
 * Everything is generated. There is no image file, no texture, no model and no
 * third-party code, which keeps the whole thing under ten kilobytes and means
 * nothing has to be fetched before it can run.
 *
 * The canvas is literally one pixel per cell, scaled up by CSS with
 * image-rendering: pixelated. A 1-bit look wants hard square edges, and this
 * gets them for free while keeping the buffer at about twenty thousand pixels
 * rather than three million.
 */

/** Deterministic, so the shape is the same on every visit and every machine. */
const seeded = (seed: number): (() => number) => {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

/**
 * Ordered dither, 8 by 8. The mechanical, grid-locked grain of a Bayer matrix
 * suits a page built on a visible hairline grid. Error diffusion would look
 * softer and more photographic, which is the opposite of what this page is.
 */
const BAYER = [
  0, 32, 8, 40, 2, 34, 10, 42, 48, 16, 56, 24, 50, 18, 58, 26, 12, 44, 4, 36, 14, 46, 6, 38, 60, 28,
  52, 20, 62, 30, 54, 22, 3, 35, 11, 43, 1, 33, 9, 41, 51, 19, 59, 27, 49, 17, 57, 25, 15, 47, 7,
  39, 13, 45, 5, 37, 63, 31, 55, 23, 61, 29, 53, 21,
].map((value) => (value + 0.5) / 64);

interface Grid {
  cols: number;
  rows: number;
}

/**
 * The organic half: a tree, drawn recursively and read back as density.
 *
 * Drawn rather than computed per cell because a line is easier to reason about
 * than a distance function, and at this resolution the whole render costs less
 * than a millisecond.
 */
const growTree = (context: CanvasRenderingContext2D, grid: Grid, random: () => number): void => {
  const { cols, rows } = grid;
  context.fillStyle = '#000';
  context.fillRect(0, 0, cols, rows);
  context.strokeStyle = '#fff';
  context.lineCap = 'round';

  const branch = (
    x: number,
    y: number,
    angle: number,
    length: number,
    width: number,
    depth: number,
  ): void => {
    if (depth > 9 || length < 1.2) return;

    const endX = x + Math.cos(angle) * length;
    const endY = y + Math.sin(angle) * length;

    context.lineWidth = width;
    // Thin twigs are faint, so the canopy fades out rather than stopping.
    context.globalAlpha = Math.min(1, 0.35 + depth * 0.08);
    context.beginPath();
    context.moveTo(x, y);
    context.lineTo(endX, endY);
    context.stroke();

    // Two children most of the time, three occasionally, so the silhouette is
    // not obviously symmetrical.
    const children = random() < 0.22 ? 3 : 2;
    for (let i = 0; i < children; i += 1) {
      const spread = 0.42 + random() * 0.34;
      const turn = (i - (children - 1) / 2) * spread + (random() - 0.5) * 0.22;
      branch(
        endX,
        endY,
        angle + turn,
        length * (0.68 + random() * 0.16),
        Math.max(0.5, width * 0.66),
        depth + 1,
      );
    }
  };

  // Rooted below the frame, so the trunk runs off the bottom edge rather than
  // sitting on it like an object on a shelf. Sized against the shorter side,
  // so a tall narrow phone gets a whole tree rather than a length of trunk.
  const reach = Math.min(cols, rows) * 0.34;
  branch(cols * 0.46, rows * 1.06, -Math.PI / 2, reach, Math.max(2, cols * 0.016), 0);
  context.globalAlpha = 1;
};

/**
 * The technical half: orthogonal traces, pads and vias.
 *
 * Routed on a coarse lattice with right angles only. The rule that makes it
 * read as a circuit rather than a maze is that a trace turns at most twice and
 * ends on a pad.
 */
const etchCircuit = (
  context: CanvasRenderingContext2D,
  grid: Grid,
  random: () => number,
): void => {
  const { cols, rows } = grid;
  context.fillStyle = '#000';
  context.fillRect(0, 0, cols, rows);
  context.strokeStyle = '#fff';
  context.fillStyle = '#fff';
  context.lineCap = 'butt';

  const pitch = Math.max(6, Math.round(cols / 26));
  const pad = Math.max(2, Math.round(pitch * 0.34));

  for (let y = pitch; y < rows; y += pitch) {
    for (let x = pitch; x < cols; x += pitch) {
      if (random() < 0.34) continue;

      // A pad, and a trace leaving it.
      context.globalAlpha = 0.9;
      context.fillRect(x - pad / 2, y - pad / 2, pad, pad);

      context.globalAlpha = 0.55 + random() * 0.3;
      context.lineWidth = Math.max(1, pad * 0.4);
      context.beginPath();
      context.moveTo(x, y);

      const horizontal = random() < 0.5;
      const run = pitch * (1 + Math.floor(random() * 3));
      const direction = random() < 0.5 ? 1 : -1;

      if (horizontal) {
        context.lineTo(x + run * direction, y);
        if (random() < 0.6) context.lineTo(x + run * direction, y + pitch * direction);
      } else {
        context.lineTo(x, y + run * direction);
        if (random() < 0.6) context.lineTo(x + pitch * direction, y + run * direction);
      }
      context.stroke();
    }
  }

  // A few long bus lines, which is what makes a die read as a die.
  context.globalAlpha = 0.8;
  context.lineWidth = Math.max(1, pad * 0.5);
  for (let i = 0; i < 5; i += 1) {
    const y = Math.round(random() * rows);
    context.beginPath();
    context.moveTo(0, y);
    context.lineTo(cols, y);
    context.stroke();
  }
  context.globalAlpha = 1;
};

/** Reads one drawn canvas back as a density field, 0 to 1 per cell. */
const readField = (context: CanvasRenderingContext2D, grid: Grid): Float32Array => {
  const { data } = context.getImageData(0, 0, grid.cols, grid.rows);
  const field = new Float32Array(grid.cols * grid.rows);
  for (let i = 0; i < field.length; i += 1) field[i] = (data[i * 4] ?? 0) / 255;
  return field;
};

export interface DitherOptions {
  canvas: HTMLCanvasElement;
  /** The element whose scroll progress drives the blend. */
  track: HTMLElement;
  /** Roughly how many CSS pixels one cell occupies. */
  cell?: number;
}

export const mountDither = ({ canvas, track, cell = 7 }: DitherOptions): (() => void) => {
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) return () => {};

  const quiet = window.matchMedia('(prefers-reduced-motion: reduce)');

  let grid: Grid = { cols: 0, rows: 0 };
  // Annotated, because the buffer type inferred from getImageData is wider
  // than the one inferred from the constructor and the two will not assign.
  let organic: Float32Array<ArrayBufferLike> = new Float32Array(0);
  let circuit: Float32Array<ArrayBufferLike> = new Float32Array(0);
  let image: ImageData | null = null;
  let ink: [number, number, number] = [0, 0, 0];
  let ground: [number, number, number] = [255, 255, 255];
  let progress = 0;
  let painted = -1;
  let frame = 0;

  /** Reads the two theme colours out of CSS, so this follows the toggle. */
  const readColours = (): void => {
    const styles = getComputedStyle(document.documentElement);
    const parse = (value: string, fallback: [number, number, number]): [number, number, number] => {
      const hex = value.trim();
      if (!/^#[0-9a-f]{6}$/i.test(hex)) return fallback;
      return [
        parseInt(hex.slice(1, 3), 16),
        parseInt(hex.slice(3, 5), 16),
        parseInt(hex.slice(5, 7), 16),
      ];
    };
    // The hairline colour, which the design system already treats as
    // decoration. Anything stronger competes with the headline sitting on top.
    ink = parse(styles.getPropertyValue('--hairline'), [207, 203, 196]);
    ground = parse(styles.getPropertyValue('--bg'), [238, 236, 233]);
  };

  const build = (): void => {
    const width = canvas.clientWidth || track.clientWidth;
    const height = canvas.clientHeight || track.clientHeight;
    if (width < 2 || height < 2) return;

    grid = {
      cols: Math.max(24, Math.round(width / cell)),
      rows: Math.max(24, Math.round(height / cell)),
    };
    canvas.width = grid.cols;
    canvas.height = grid.rows;

    const scratch = document.createElement('canvas');
    scratch.width = grid.cols;
    scratch.height = grid.rows;
    const scratchContext = scratch.getContext('2d', { willReadFrequently: true });
    if (!scratchContext) return;

    growTree(scratchContext, grid, seeded(20260911));
    organic = readField(scratchContext, grid);

    etchCircuit(scratchContext, grid, seeded(11092026));
    circuit = readField(scratchContext, grid);

    image = context.createImageData(grid.cols, grid.rows);
    readColours();
    painted = -1;
  };

  const paint = (t: number): void => {
    if (!image || organic.length === 0) return;

    const { cols, rows } = grid;
    const pixels = image.data;
    // Disorder peaks in the middle, which is the dither state itself: the
    // point where the field is neither one thing nor the other.
    const churn = 4 * t * (1 - t);

    for (let y = 0; y < rows; y += 1) {
      for (let x = 0; x < cols; x += 1) {
        const i = y * cols + x;
        const blended = (organic[i] ?? 0) * (1 - t) + (circuit[i] ?? 0) * t;

        // A cheap hash rather than a noise function. It only has to be
        // uncorrelated with the Bayer matrix.
        const scatter = ((Math.imul(x + 1, 374761393) ^ Math.imul(y + 1, 668265263)) >>> 8) / 65536;
        const value = blended + (scatter % 1) * churn * 0.55 - churn * 0.16;

        const threshold = BAYER[(y & 7) * 8 + (x & 7)] ?? 0.5;
        const on = value > threshold;

        const at = i * 4;
        const colour = on ? ink : ground;
        pixels[at] = colour[0];
        pixels[at + 1] = colour[1];
        pixels[at + 2] = colour[2];
        pixels[at + 3] = on ? 255 : 0;
      }
    }

    context.putImageData(image, 0, 0);
  };

  const measure = (): number => {
    const box = track.getBoundingClientRect();
    // Zero while the band is in place, one by the time it has left. Native
    // scroll position only: nothing here moves the page or intercepts a wheel.
    const travelled = -box.top;
    const distance = Math.max(1, box.height * 0.85);
    return Math.min(1, Math.max(0, travelled / distance));
  };

  const tick = (): void => {
    frame = 0;
    const next = quiet.matches ? 0.12 : measure();
    // Repainting on a hundredth is invisible and costs a full grid walk.
    if (Math.abs(next - painted) < 0.004) return;
    painted = next;
    progress = next;
    paint(progress);
  };

  const request = (): void => {
    if (frame === 0) frame = requestAnimationFrame(tick);
  };

  let resizeTimer = 0;
  const onResize = (): void => {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(() => {
      build();
      request();
    }, 180);
  };

  const onTheme = (): void => {
    readColours();
    painted = -1;
    request();
  };

  build();
  paint(quiet.matches ? 0.12 : measure());

  window.addEventListener('scroll', request, { passive: true });
  window.addEventListener('resize', onResize);
  quiet.addEventListener('change', onTheme);

  // The theme toggle writes an attribute on the root element.
  const themeWatcher = new MutationObserver(onTheme);
  themeWatcher.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme'],
  });

  return () => {
    window.removeEventListener('scroll', request);
    window.removeEventListener('resize', onResize);
    quiet.removeEventListener('change', onTheme);
    themeWatcher.disconnect();
    if (frame !== 0) cancelAnimationFrame(frame);
  };
};
