/**
 * The backdrop: four things from the ground becoming four things built on it.
 *
 * Scroll controls the frame, time controls the content. The stage swells from
 * a backdrop behind the headline to full bleed and back as you scroll past,
 * while the sequence runs on its own clock from the moment it is in view.
 * Nothing here moves the page, pins it, or intercepts a wheel: scroll position
 * is read, never written.
 *
 * With reduced motion asked for, the clock never starts. One frame is held,
 * the stage does not swell, and the page is otherwise identical.
 */

import { buildScenes, PAIR_LABELS, SCENE_COUNT, type Size } from './scenes';
import { createRenderer, type Frame, type Renderer } from './render';

/**
 * The score, in seconds. Four pairs, each one a hold on the natural field, a
 * slow dissolve, a hold on the built one, then a quicker connective move to
 * the next pair. The dissolve is the slowest part because it is the only part
 * making an argument.
 */
const HOLD_NATURE = 1.5;
const DISSOLVE = 2.6;
const HOLD_BUILT = 1.7;
const CONNECT = 1.0;
const PAIR = HOLD_NATURE + DISSOLVE + HOLD_BUILT + CONNECT;
const LOOP = PAIR * 4;

interface Beat {
  from: number;
  to: number;
  mix: number;
  churn: number;
  pair: number;
}

/** Smoothstep, so nothing starts or stops abruptly. */
const ease = (t: number): number => t * t * (3 - 2 * t);

/** Where the sequence is at a given moment. */
export const beatAt = (seconds: number): Beat => {
  const clock = ((seconds % LOOP) + LOOP) % LOOP;
  const pair = Math.floor(clock / PAIR);
  const within = clock - pair * PAIR;

  const nature = (pair * 2) % SCENE_COUNT;
  const built = nature + 1;
  const nextNature = (built + 1) % SCENE_COUNT;

  if (within < HOLD_NATURE) {
    return { from: nature, to: nature, mix: 0, churn: 0, pair };
  }
  if (within < HOLD_NATURE + DISSOLVE) {
    const t = (within - HOLD_NATURE) / DISSOLVE;
    return {
      from: nature,
      to: built,
      mix: ease(t),
      // Disorder peaks halfway: the dither state itself.
      churn: Math.sin(t * Math.PI) * 0.85,
      pair,
    };
  }
  if (within < HOLD_NATURE + DISSOLVE + HOLD_BUILT) {
    return { from: built, to: built, mix: 1, churn: 0, pair };
  }
  const t = (within - HOLD_NATURE - DISSOLVE - HOLD_BUILT) / CONNECT;
  return {
    from: built,
    to: nextNature,
    mix: ease(t),
    // Quieter than a dissolve. This move is connective tissue, not an argument.
    churn: Math.sin(t * Math.PI) * 0.3,
    pair,
  };
};

/**
 * How much of the screen the field owns, from scroll position.
 *
 * Nothing at rest, full bleed as the band passes the middle of the viewport,
 * nothing again by the time it has gone. A swell rather than a reveal, so the
 * readouts are never competing with a field at full strength.
 */
export const swellAt = (top: number, height: number, viewport: number): number => {
  const travelled = -top / Math.max(1, height);
  const centred = 1 - Math.abs(travelled - 0.32) / 0.62;
  void viewport;
  return Math.max(0, Math.min(1, centred));
};

export interface MountOptions {
  canvas: HTMLCanvasElement;
  stage: HTMLElement;
  track: HTMLElement;
  caption?: HTMLElement | null;
  /** Roughly how many CSS pixels one cell occupies. */
  cell?: number;
}

export const mountDither = ({
  canvas,
  stage,
  track,
  caption,
  cell = 5,
}: MountOptions): (() => void) => {
  const renderer: Renderer | null = createRenderer(canvas);
  if (!renderer) return () => {};

  const quiet = window.matchMedia('(prefers-reduced-motion: reduce)');

  let grid: Size = { width: 0, height: 0 };
  let ink: [number, number, number] = [207, 203, 196];
  let ground: [number, number, number] = [238, 236, 233];
  let started = 0;
  let running = false;
  let frame = 0;
  let visible = true;
  let shownPair = -1;

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
    // The hairline colour. The design system already calls it decoration, and
    // anything stronger competes with the headline sitting on top of it.
    ink = parse(styles.getPropertyValue('--hairline'), ink);
    ground = parse(styles.getPropertyValue('--bg'), ground);
  };

  const build = (): void => {
    const width = stage.clientWidth;
    const height = stage.clientHeight;
    if (width < 8 || height < 8) return;

    // The shader evaluates every cell every frame, so it can afford a finer
    // grid than the fallback, which walks them in JavaScript.
    const size = renderer.kind === 'webgl2' ? cell : cell * 1.8;
    grid = {
      width: Math.max(32, Math.round(width / size)),
      height: Math.max(24, Math.round(height / size)),
    };
    renderer.resize(grid, buildScenes(grid));
    readColours();
  };

  const paint = (seconds: number): void => {
    const beat = beatAt(seconds);
    const swell = quiet.matches
      ? 0
      : swellAt(track.getBoundingClientRect().top, track.offsetHeight, window.innerHeight);

    stage.style.setProperty('--swell', swell.toFixed(3));

    const payload: Frame = { ...beat, time: seconds, ink, ground };
    renderer.draw(payload);

    if (caption && beat.pair !== shownPair) {
      shownPair = beat.pair;
      caption.textContent = PAIR_LABELS[beat.pair] ?? '';
    }
  };

  const tick = (now: number): void => {
    if (!running) return;
    frame = requestAnimationFrame(tick);
    if (started === 0) started = now;
    paint((now - started) / 1000);
  };

  const start = (): void => {
    if (running || quiet.matches) return;
    running = true;
    frame = requestAnimationFrame(tick);
  };

  const stop = (): void => {
    running = false;
    if (frame !== 0) cancelAnimationFrame(frame);
    frame = 0;
  };

  /**
   * Off screen means no work at all. A backdrop nobody can see has no business
   * holding a frame loop open, least of all on a page arguing about the cost
   * of computation.
   */
  const watcher = new IntersectionObserver(
    (entries) => {
      visible = entries.some((entry) => entry.isIntersecting);
      if (visible) start();
      else stop();
    },
    { rootMargin: '120px' },
  );
  watcher.observe(track);

  let resizeTimer = 0;
  const onResize = (): void => {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(() => {
      build();
      if (!running) paint(0);
    }, 200);
  };

  const onTheme = (): void => {
    readColours();
    if (!running) paint(0);
  };

  const onQuiet = (): void => {
    if (quiet.matches) {
      stop();
      stage.style.setProperty('--swell', '0');
      paint(HOLD_NATURE + DISSOLVE * 0.5);
    } else if (visible) {
      started = 0;
      start();
    }
  };

  build();
  // One frame immediately, so the page never shows an empty rectangle while
  // it waits for the observer to fire.
  paint(quiet.matches ? HOLD_NATURE + DISSOLVE * 0.5 : 0);

  window.addEventListener('resize', onResize);
  quiet.addEventListener('change', onQuiet);

  const themeWatcher = new MutationObserver(onTheme);
  themeWatcher.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme'],
  });

  return () => {
    stop();
    watcher.disconnect();
    themeWatcher.disconnect();
    window.removeEventListener('resize', onResize);
    quiet.removeEventListener('change', onQuiet);
    renderer.destroy();
  };
};
