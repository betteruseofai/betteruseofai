/**
 * The eight fields the backdrop moves through.
 *
 * Four pairs, each one a natural thing becoming a built thing:
 *
 *   I    canopy        becomes  a rack elevation
 *   II   river         becomes  a coolant loop
 *   III  soil strata   becomes  wafer layers
 *   IV   root network  becomes  fibre and traces
 *
 * Each is drawn with a 2D context and read back as a single channel of
 * density. Drawing rather than computing per cell because a line is easier to
 * reason about than a distance function, and the whole set is generated once
 * at load: eight small renders, a few milliseconds, no files to fetch.
 *
 * The pairs share their composition on purpose. The rack's rails land where
 * the trunk and main branches were; the coolant loop follows the river's
 * course; the wafer's layers sit on the soil's horizons. The dissolve is only
 * convincing when there is something underneath it to dissolve into.
 */

export const SCENE_COUNT = 9;

export const SCENE_NAMES = [
  'canopy',
  'rack',
  'river',
  'coolant',
  'soil',
  'wafer',
  'roots',
  'traces',
  'composer',
] as const;

/** What the caption says, one per pair, and one for where it ends. */
export const PAIR_LABELS = [
  'I · canopy becomes rack',
  'II · river becomes coolant',
  'III · soil becomes wafer',
  'IV · roots become fibre',
  'V · fibre reaches the box you type in',
] as const;

/**
 * Where the prompt box sits, as fractions of the stage. Shared with the
 * caret the page draws over it, so the blink lands inside the box.
 */
export const COMPOSER = { left: 0.6, top: 0.16, right: 0.93, bottom: 0.38 } as const;

export interface Size {
  width: number;
  height: number;
}

/** Deterministic, so the composition is the same on every visit. */
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

type Draw = (context: CanvasRenderingContext2D, size: Size, random: () => number) => void;

const clear = (context: CanvasRenderingContext2D, size: Size): void => {
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.globalAlpha = 1;
  context.globalCompositeOperation = 'source-over';
  context.fillStyle = '#000';
  context.fillRect(0, 0, size.width, size.height);
  context.strokeStyle = '#fff';
  context.fillStyle = '#fff';
  context.lineCap = 'round';
  context.lineJoin = 'round';
};

// ------------------------------------------------------------- I. canopy

/*
 * Where the trunk stands, in fractions of the frame. Shared with the rack.
 *
 * Well right of centre, because the left of the stage is where the headline
 * and the sentence live and the scrim holds the ground opaque there. A
 * composition centred on the frame is a composition centred under the text.
 */
const TRUNK_X = 0.72;

/*
 * The ground line, as a fraction of the frame.
 *
 * The stage covers the whole band, but the field is masked away below roughly
 * the top two fifths until the swell rises. A scene anchored lower than this
 * is a scene nobody ever sees, which is what happened to the first tree twice:
 * once rooted off the bottom edge, once sitting exactly on the fade.
 */
const BASE = 0.46;

const canopy: Draw = (context, size, random) => {
  clear(context, size);
  const { width, height } = size;
  const reach = height * 0.34;

  const branch = (
    x: number,
    y: number,
    angle: number,
    length: number,
    thickness: number,
    depth: number,
  ): void => {
    if (depth > 9 || length < 1.2) return;
    const endX = x + Math.cos(angle) * length;
    const endY = y + Math.sin(angle) * length;

    context.lineWidth = thickness;
    context.globalAlpha = Math.min(1, 0.34 + depth * 0.08);
    context.beginPath();
    context.moveTo(x, y);
    context.lineTo(endX, endY);
    context.stroke();

    const children = random() < 0.22 ? 3 : 2;
    for (let i = 0; i < children; i += 1) {
      const spread = 0.42 + random() * 0.34;
      const turn = (i - (children - 1) / 2) * spread + (random() - 0.5) * 0.22;
      branch(
        endX,
        endY,
        angle + turn,
        length * (0.68 + random() * 0.16),
        Math.max(0.5, thickness * 0.66),
        depth + 1,
      );
    }
  };

  branch(width * TRUNK_X, height * (BASE + 0.02), -Math.PI / 2, reach, Math.max(2, width * 0.016), 0);

  /*
   * Leaf mass. Dense enough that the canopy reads as a shape rather than a few
   * twigs: at four per cent coverage the first version looked like dust, and
   * the dither needs something to threshold against.
   */
  context.globalAlpha = 0.5;
  for (let i = 0; i < width * 18; i += 1) {
    const a = random() * Math.PI * 2;
    const r = Math.pow(random(), 0.45) * reach * 1.1;
    const x = width * TRUNK_X + Math.cos(a) * r * 1.5;
    const y = height * (BASE - 0.18) + Math.sin(a) * r * 0.78;
    context.fillRect(x, y, 1, 1);
  }
  context.globalAlpha = 1;
};

// --------------------------------------------------------------- I. rack

const rack: Draw = (context, size, random) => {
  clear(context, size);
  const { width, height } = size;

  // Two uprights where the trunk was, so the dissolve has somewhere to land.
  const centre = width * TRUNK_X;
  const bay = Math.min(width, height * BASE) * 0.82;
  const left = centre - bay / 2;
  const right = centre + bay / 2;
  const top = height * 0.05;
  const bottom = height * (BASE + 0.02);

  context.globalAlpha = 0.95;
  context.lineWidth = Math.max(2, width * 0.006);
  for (const x of [left, right]) {
    context.beginPath();
    context.moveTo(x, top);
    context.lineTo(x, bottom);
    context.stroke();
  }

  // Rack units. A gap here and there, because no rack is ever full.
  const unit = Math.max(4, (bottom - top) / 26);
  for (let y = top + unit; y < bottom; y += unit) {
    if (random() < 0.12) continue;
    context.globalAlpha = 0.5 + random() * 0.4;
    context.lineWidth = Math.max(1, unit * 0.34);
    context.beginPath();
    context.moveTo(left, y);
    context.lineTo(right, y);
    context.stroke();

    // Status lights and vents, which is what makes a rack read as a rack.
    context.globalAlpha = 0.9;
    const lights = 2 + Math.floor(random() * 3);
    for (let i = 0; i < lights; i += 1) {
      context.fillRect(left + bay * (0.06 + i * 0.055), y - unit * 0.16, 1.4, 1.4);
    }
  }

  // A second bay, half out of frame, so the hall continues past the edge.
  context.globalAlpha = 0.4;
  context.lineWidth = Math.max(1.5, width * 0.004);
  const far = right + bay * 0.55;
  context.beginPath();
  context.moveTo(far, top + unit * 2);
  context.lineTo(far, bottom);
  context.stroke();
  context.globalAlpha = 1;
};

// -------------------------------------------------------------- II. river

/** The course both the river and the coolant loop follow. */
const course = (width: number, height: number, t: number): { x: number; y: number } => ({
  x: width * (0.26 + t * 0.8),
  y: height * (0.24 + Math.sin(t * 5.2) * 0.13 + Math.sin(t * 2.1 + 1.1) * 0.06),
});

const river: Draw = (context, size, random) => {
  clear(context, size);
  const { width, height } = size;

  // Braided channels either side of the main course.
  for (let strand = 0; strand < 9; strand += 1) {
    const offset = (strand - 4) * Math.max(1.4, height * 0.016);
    const fade = 1 - Math.abs(strand - 4) / 5.5;
    context.globalAlpha = 0.2 + fade * 0.65;
    context.lineWidth = Math.max(0.8, height * 0.008 * fade);
    context.beginPath();
    for (let i = 0; i <= 90; i += 1) {
      const point = course(width, height, i / 90);
      const wobble = Math.sin(i * 0.4 + strand) * height * 0.008;
      if (i === 0) context.moveTo(point.x, point.y + offset + wobble);
      else context.lineTo(point.x, point.y + offset + wobble);
    }
    context.stroke();
  }

  // Spray, so the water has surface rather than being only lines.
  context.globalAlpha = 0.3;
  for (let i = 0; i < width * 1.1; i += 1) {
    const t = random();
    const point = course(width, height, t);
    const spread = (random() - 0.5) * height * 0.14;
    context.fillRect(point.x, point.y + spread, 1, 1);
  }
  context.globalAlpha = 1;
};

// ------------------------------------------------------------ II. coolant

const coolant: Draw = (context, size, random) => {
  clear(context, size);
  const { width, height } = size;

  // The same course, straightened into pipe runs with right-angled returns.
  context.globalAlpha = 0.9;
  context.lineWidth = Math.max(2, height * 0.018);
  context.lineCap = 'butt';

  const runs = 5;
  for (let i = 0; i < runs; i += 1) {
    const start = i / runs;
    const end = (i + 1) / runs;
    const a = course(width, height, start);
    const b = course(width, height, end);
    const y = Math.round(a.y / (height * 0.06)) * height * 0.06;

    context.beginPath();
    context.moveTo(a.x, y);
    context.lineTo(b.x, y);
    // The return bend, up or down, which is what makes it a loop.
    context.lineTo(b.x, y + (i % 2 === 0 ? 1 : -1) * height * 0.12);
    context.stroke();

    // Flanges at each joint.
    context.fillRect(b.x - 2, y - height * 0.022, 4, height * 0.044);
  }

  // Manifold down one side, and a few risers off it.
  const manifold = width * 0.06;
  context.lineWidth = Math.max(2.5, height * 0.022);
  context.beginPath();
  context.moveTo(manifold, height * 0.14);
  context.lineTo(manifold, height * 0.96);
  context.stroke();

  context.lineWidth = Math.max(1, height * 0.01);
  for (let i = 0; i < 7; i += 1) {
    const y = height * (0.18 + i * 0.11);
    context.globalAlpha = 0.45 + random() * 0.4;
    context.beginPath();
    context.moveTo(manifold, y);
    context.lineTo(manifold + width * (0.06 + random() * 0.12), y);
    context.stroke();
  }
  context.globalAlpha = 1;
  context.lineCap = 'round';
};

// -------------------------------------------------------------- III. soil

/** The horizons both the soil and the wafer sit on. */
const HORIZONS = [0.04, 0.12, 0.2, 0.28, 0.35, 0.42];

const soil: Draw = (context, size, random) => {
  clear(context, size);
  const { width, height } = size;

  HORIZONS.forEach((at, band) => {
    const next = HORIZONS[band + 1] ?? BASE + 0.02;
    const top = height * at;
    const depth = height * (next - at);

    // Grain, denser toward the bottom of each horizon.
    const grains = width * depth * 0.16;
    context.globalAlpha = 0.5;
    for (let i = 0; i < grains; i += 1) {
      const y = top + Math.pow(random(), 0.7) * depth;
      const x = random() * width;
      const size = random() < 0.12 ? 2 : 1;
      context.fillRect(x, y, size, size);
    }

    // A ragged boundary, because soil horizons are not ruled lines.
    context.globalAlpha = 0.7;
    context.lineWidth = 1;
    context.beginPath();
    for (let x = 0; x <= width; x += 2) {
      const y = top + Math.sin(x * 0.06 + band * 2.1) * height * 0.008 + (random() - 0.5) * 2;
      if (x === 0) context.moveTo(x, y);
      else context.lineTo(x, y);
    }
    context.stroke();
  });

  // Stones and voids.
  context.globalAlpha = 0.55;
  for (let i = 0; i < width * 0.1; i += 1) {
    const x = random() * width;
    const y = height * (0.06 + random() * BASE * 0.8);
    const r = 1 + random() * Math.max(1.5, height * 0.012);
    context.beginPath();
    context.arc(x, y, r, 0, Math.PI * 2);
    context.stroke();
  }
  context.globalAlpha = 1;
};

// ------------------------------------------------------------- III. wafer

const wafer: Draw = (context, size, random) => {
  clear(context, size);
  const { width, height } = size;

  // The same horizons, now ruled dead straight: a die in cross section.
  HORIZONS.forEach((at, band) => {
    const next = HORIZONS[band + 1] ?? BASE + 0.02;
    const top = height * at;
    const depth = height * (next - at);

    context.globalAlpha = 0.92;
    context.lineWidth = Math.max(1, height * 0.004);
    context.beginPath();
    context.moveTo(0, top);
    context.lineTo(width, top);
    context.stroke();

    // Metal fill in alternating layers, hatched rather than solid.
    if (band % 2 === 0) {
      context.globalAlpha = 0.3;
      context.lineWidth = 1;
      for (let x = 0; x < width; x += 4) {
        context.beginPath();
        context.moveTo(x, top + 1);
        context.lineTo(x, top + depth - 1);
        context.stroke();
      }
    }

    // Vias tying one layer to the next.
    context.globalAlpha = 0.85;
    const pitch = Math.max(8, width / 22);
    for (let x = pitch; x < width; x += pitch) {
      if (random() < 0.35) continue;
      const w = Math.max(2, pitch * 0.16);
      context.fillRect(x - w / 2, top, w, depth * 0.92);
    }
  });

  // The substrate, solid under everything.
  context.globalAlpha = 0.5;
  context.fillRect(0, height * (BASE - 0.02), width, height * 0.05);
  context.globalAlpha = 1;
};

// -------------------------------------------------------------- IV. roots

const roots: Draw = (context, size, random) => {
  clear(context, size);
  const { width, height } = size;
  const reach = height * 0.3;

  // The canopy again, inverted and finer. Roots branch more and thinner.
  const branch = (
    x: number,
    y: number,
    angle: number,
    length: number,
    thickness: number,
    depth: number,
  ): void => {
    if (depth > 10 || length < 1) return;
    const endX = x + Math.cos(angle) * length;
    const endY = y + Math.sin(angle) * length;

    context.lineWidth = thickness;
    context.globalAlpha = Math.min(0.9, 0.3 + depth * 0.07);
    context.beginPath();
    context.moveTo(x, y);
    context.lineTo(endX, endY);
    context.stroke();

    const children = random() < 0.4 ? 3 : 2;
    for (let i = 0; i < children; i += 1) {
      const spread = 0.5 + random() * 0.45;
      const turn = (i - (children - 1) / 2) * spread + (random() - 0.5) * 0.3;
      branch(
        endX,
        endY,
        angle + turn,
        length * (0.7 + random() * 0.14),
        Math.max(0.4, thickness * 0.62),
        depth + 1,
      );
    }
  };

  branch(width * TRUNK_X, height * 0.03, Math.PI / 2, reach, Math.max(1.6, width * 0.012), 0);

  // Fine hairs, the part that actually does the work.
  context.globalAlpha = 0.4;
  for (let i = 0; i < width * 14; i += 1) {
    const a = random() * Math.PI * 2;
    const r = Math.pow(random(), 0.45) * reach * 1.2;
    context.fillRect(
      width * TRUNK_X + Math.cos(a) * r * 1.5,
      height * 0.2 + Math.sin(a) * r * 0.85,
      1,
      1,
    );
  }
  context.globalAlpha = 1;
};

// ------------------------------------------------------------- IV. traces

const traces: Draw = (context, size, random) => {
  clear(context, size);
  const { width, height } = size;
  context.lineCap = 'butt';

  const pitch = Math.max(6, Math.round(width / 26));
  const pad = Math.max(2, Math.round(pitch * 0.34));

  const floor = height * (BASE + 0.02);
  for (let y = pitch; y < floor; y += pitch) {
    for (let x = pitch; x < width; x += pitch) {
      if (random() < 0.34) continue;

      context.globalAlpha = 0.9;
      context.fillRect(x - pad / 2, y - pad / 2, pad, pad);

      context.globalAlpha = 0.55 + random() * 0.3;
      context.lineWidth = Math.max(1, pad * 0.4);
      context.beginPath();
      context.moveTo(x, y);

      const run = pitch * (1 + Math.floor(random() * 3));
      const direction = random() < 0.5 ? 1 : -1;
      if (random() < 0.5) {
        context.lineTo(x + run * direction, y);
        if (random() < 0.6) context.lineTo(x + run * direction, y + pitch * direction);
      } else {
        context.lineTo(x, y + run * direction);
        if (random() < 0.6) context.lineTo(x + pitch * direction, y + run * direction);
      }
      context.stroke();
    }
  }

  // Fibre: long uninterrupted runs, which is what roots become.
  context.globalAlpha = 0.85;
  context.lineWidth = Math.max(1, pad * 0.5);
  for (let i = 0; i < 6; i += 1) {
    const y = Math.round(random() * floor);
    context.beginPath();
    context.moveTo(0, y);
    context.lineTo(width, y);
    context.stroke();
  }
  context.globalAlpha = 1;
  context.lineCap = 'round';
};

// ------------------------------------------------------------ V. composer

/*
 * Where the sequence ends and stays: the box you type into, with the fibre
 * from the fourth pair running into it. This is the frame the reduced-motion
 * and still-mode readers see, so it is drawn as a composition in its own
 * right rather than as a stopped animation: the traces thin out toward the
 * box, the box is the one solid outline on the stage, and the cursor cell
 * sits where the first letter would go.
 */
const composer: Draw = (context, size, random) => {
  clear(context, size);
  const { width, height } = size;
  context.lineCap = 'butt';

  const left = width * COMPOSER.left;
  const top = height * COMPOSER.top;
  const right = width * COMPOSER.right;
  const bottom = height * COMPOSER.bottom;

  // Fibre runs from the left edge into the box, fewer and fainter as they go.
  const pitch = Math.max(6, Math.round(width / 26));
  const pad = Math.max(2, Math.round(pitch * 0.34));
  context.lineWidth = Math.max(1, pad * 0.5);
  for (let i = 0; i < 7; i += 1) {
    const y = top + ((i + 0.5) / 7) * (bottom - top);
    const reach = random() < 0.5 ? left : left - pitch * (1 + Math.floor(random() * 3));
    context.globalAlpha = 0.25 + random() * 0.45;
    context.beginPath();
    context.moveTo(0, y);
    context.lineTo(reach, y);
    if (reach < left) {
      // A right-angled step onto the box, the way a trace meets a pad.
      const step = y + (random() < 0.5 ? 1 : -1) * pitch * 0.5;
      context.lineTo(reach, step);
      context.lineTo(left, step);
    }
    context.stroke();
    // A pad where the run meets the box.
    context.globalAlpha = 0.8;
    context.fillRect(left - pad, y - pad / 2, pad, pad);
  }

  // A sparse field of pads behind the runs, so the left is still a board.
  for (let y = pitch; y < height * (BASE + 0.02); y += pitch) {
    for (let x = pitch; x < left - pitch; x += pitch) {
      if (random() < 0.82) continue;
      context.globalAlpha = 0.35;
      context.fillRect(x - pad / 2, y - pad / 2, pad, pad);
    }
  }

  // The box. The one thing on the stage drawn as a closed outline.
  context.globalAlpha = 1;
  context.lineWidth = Math.max(2, width * 0.005);
  context.strokeRect(left, top, right - left, bottom - top);

  // The cursor cell, where the first letter goes. The page blinks a caret
  // over this spot; with motion off the cell simply stays.
  const cell = Math.max(3, width * 0.008);
  context.fillRect(left + cell * 1.6, top + cell * 1.6, cell, cell * 3);

  // A send control at the far end of the box, drawn as a filled square.
  context.globalAlpha = 0.9;
  context.fillRect(right - cell * 4, bottom - cell * 4, cell * 2.4, cell * 2.4);

  context.globalAlpha = 1;
  context.lineCap = 'round';
};

const DRAWERS: Draw[] = [canopy, rack, river, coolant, soil, wafer, roots, traces, composer];

/**
 * Renders all eight fields into one interleaved byte array, ready to upload as
 * a texture array: one byte of density per cell per layer.
 */
export const buildScenes = (size: Size): Uint8Array => {
  const scratch = document.createElement('canvas');
  scratch.width = size.width;
  scratch.height = size.height;
  const context = scratch.getContext('2d', { willReadFrequently: true });

  const cells = size.width * size.height;
  const out = new Uint8Array(cells * SCENE_COUNT);
  if (!context) return out;

  DRAWERS.forEach((draw, layer) => {
    // A separate seed per field, fixed, so nothing shifts between reloads.
    draw(context, size, seeded(0x9e3779b9 + layer * 2654435761));
    const { data } = context.getImageData(0, 0, size.width, size.height);
    const base = layer * cells;
    for (let i = 0; i < cells; i += 1) out[base + i] = data[i * 4] ?? 0;
  });

  return out;
};
