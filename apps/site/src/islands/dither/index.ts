/**
 * The backdrop: four things from the ground becoming four things built on it,
 * and then the box you type into.
 *
 * Scroll controls the frame, time controls the content. The stage swells from
 * a backdrop behind the headline to full bleed and back as you scroll past,
 * while the sequence runs on its own clock from the moment it is in view.
 * Nothing here moves the page, pins it, or intercepts a wheel: scroll position
 * is read, never written.
 *
 * It plays once. Four pairs, a connective move into the composer, and then it
 * stops on that frame for as long as the page is open. A loop that runs for
 * ever is decoration, and decoration has no business drawing power on a page
 * about the cost of computation. One pass is the argument; after that the
 * page is still, and its cost is fixed and small enough to print in the footer.
 *
 * With reduced motion asked for, or the still toggle on, or no WebGL2, the
 * clock never starts. The frame the sequence ends on is drawn once and held,
 * so the still readers see the composed ending rather than a stopped middle.
 */

import { buildScenes, COMPOSER, PAIR_LABELS, SCENE_COUNT, type Size } from './scenes';
import { createRenderer, type Frame, type Renderer } from './render';

/**
 * The score, in seconds. Four pairs, each one a hold on the natural field, a
 * slow dissolve, a hold on the built one, then a quicker connective move to
 * the next pair. The dissolve is the slowest part because it is the only part
 * making an argument. The fourth connective move lands on the composer, and
 * the sequence ends there.
 */
const HOLD_NATURE = 1.5;
const DISSOLVE = 2.6;
const HOLD_BUILT = 1.7;
const CONNECT = 1.0;
const PAIR = HOLD_NATURE + DISSOLVE + HOLD_BUILT + CONNECT;
const PAIRS = 4;

/** When the sequence has finished and holds. */
export const END = PAIR * PAIRS;

/** The frame held for reduced motion, still mode, and after the pass. */
const FINAL = SCENE_COUNT - 1;

interface Beat {
  from: number;
  to: number;
  mix: number;
  churn: number;
  pair: number;
}

/** Smoothstep, so nothing starts or stops abruptly. */
const ease = (t: number): number => t * t * (3 - 2 * t);

/** Where the sequence is at a given moment. Past the end, it is at the end. */
export const beatAt = (seconds: number): Beat => {
  if (seconds >= END) return { from: FINAL, to: FINAL, mix: 1, churn: 0, pair: PAIRS };

  const clock = Math.max(0, seconds);
  const pair = Math.floor(clock / PAIR);
  const within = clock - pair * PAIR;

  const nature = pair * 2;
  const built = nature + 1;
  const next = Math.min(built + 1, FINAL);

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
    to: next,
    mix: ease(t),
    // Quieter than a dissolve. This move is connective tissue, not an argument.
    churn: Math.sin(t * Math.PI) * 0.3,
    // The last connective move is captioned as the ending it leads to.
    pair: next === FINAL ? PAIRS : pair,
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
  const root = document.documentElement;

  /** Reduced motion, or the reader's own toggle. Either one holds the frame. */
  const still = (): boolean => quiet.matches || root.dataset['still'] === '1';

  let grid: Size = { width: 0, height: 0 };
  let ink: [number, number, number] = [207, 203, 196];
  let ground: [number, number, number] = [238, 236, 233];
  let started = 0;
  let elapsed = 0;
  let running = false;
  let ended = false;
  let frame = 0;
  let visible = true;
  let shownPair = -1;

  // The caret the page blinks over the cursor cell, placed from the same
  // geometry the scene was drawn with.
  const cellPx = () => Math.max(3, stage.clientWidth * 0.008);
  const placeCaret = (): void => {
    const size = cellPx();
    stage.style.setProperty('--caret-x', `${stage.clientWidth * COMPOSER.left + size * 1.6}px`);
    stage.style.setProperty('--caret-y', `${stage.clientHeight * COMPOSER.top + size * 1.6}px`);
    stage.style.setProperty('--caret-w', `${size}px`);
    stage.style.setProperty('--caret-h', `${size * 3}px`);
  };

  const readColours = (): void => {
    const styles = getComputedStyle(root);
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
    placeCaret();
  };

  const swell = (): void => {
    const value = still()
      ? 0
      : swellAt(track.getBoundingClientRect().top, track.offsetHeight, window.innerHeight);
    stage.style.setProperty('--swell', value.toFixed(3));
  };

  const paint = (seconds: number): void => {
    const beat = beatAt(seconds);
    swell();

    const payload: Frame = { ...beat, time: seconds, ink, ground };
    renderer.draw(payload);

    if (caption && beat.pair !== shownPair) {
      shownPair = beat.pair;
      caption.textContent = PAIR_LABELS[beat.pair] ?? '';
    }
  };

  /** The composed ending, drawn once and held. */
  const finish = (): void => {
    ended = true;
    stop();
    paint(END);
    stage.dataset['ended'] = '1';
  };

  const tick = (now: number): void => {
    if (!running) return;
    if (started === 0) started = now - elapsed * 1000;
    elapsed = (now - started) / 1000;
    if (elapsed >= END) {
      finish();
      return;
    }
    frame = requestAnimationFrame(tick);
    paint(elapsed);
  };

  const start = (): void => {
    if (running || ended || still() || document.hidden) return;
    running = true;
    started = 0;
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
   * of computation. Coming back into view resumes from where it paused.
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

  // A hidden tab stops the clock outright. Browsers throttle animation frames
  // there already; this says so in the code rather than relying on it.
  const onVisibility = (): void => {
    if (document.hidden) stop();
    else if (visible) start();
  };

  let resizeTimer = 0;
  const onResize = (): void => {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(() => {
      build();
      if (!running) paint(ended || still() ? END : elapsed);
    }, 200);
  };

  // Once the clock has stopped, scrolling still shapes the stage. This writes
  // one custom property and draws nothing.
  const onScroll = (): void => {
    if (!running) swell();
  };

  const onTheme = (): void => {
    readColours();
    if (!running) paint(ended || still() ? END : elapsed);
  };

  const onStill = (): void => {
    if (still()) {
      stop();
      paint(END);
      stage.dataset['ended'] = '1';
    } else if (!ended) {
      delete stage.dataset['ended'];
      if (visible) start();
    }
  };

  build();

  if (renderer.kind === 'canvas2d') {
    // No WebGL2 means a machine that should not be asked to animate. It gets
    // the ending, drawn once in JavaScript, and nothing else.
    paint(END);
    stage.dataset['ended'] = '1';
  } else if (still()) {
    paint(END);
    stage.dataset['ended'] = '1';
  } else {
    // One frame immediately, so the page never shows an empty rectangle while
    // it waits for the observer to fire.
    paint(0);
  }

  window.addEventListener('resize', onResize);
  window.addEventListener('scroll', onScroll, { passive: true });
  document.addEventListener('visibilitychange', onVisibility);
  quiet.addEventListener('change', onStill);

  const rootWatcher = new MutationObserver((records) => {
    for (const record of records) {
      if (record.attributeName === 'data-theme') onTheme();
      if (record.attributeName === 'data-still') onStill();
    }
  });
  rootWatcher.observe(root, { attributes: true, attributeFilter: ['data-theme', 'data-still'] });

  return () => {
    stop();
    watcher.disconnect();
    rootWatcher.disconnect();
    window.removeEventListener('resize', onResize);
    window.removeEventListener('scroll', onScroll);
    document.removeEventListener('visibilitychange', onVisibility);
    quiet.removeEventListener('change', onStill);
    renderer.destroy();
  };
};
