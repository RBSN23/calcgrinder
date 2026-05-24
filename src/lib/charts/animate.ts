// PROJ-15 — Animation runtime helper.
//
// Single graceful-degrade path: WAAPI (Element.animate) wrapped in try/catch,
// feature-detected, gated by per-chart toggle + OS reduced-motion. Older
// browsers without WAAPI (or with it disabled) snap to the final state —
// same end-state, no visual glitch.
//
// Animation is constrained to `transform` and `opacity` against a stable
// underlying SVG path. We do NOT animate `d`, `x`, `y` directly — those
// have spotty browser support on SVG.

import { CHART_ANIMATION_MS } from './limits';

/** Reads OS `prefers-reduced-motion`. SSR-safe (returns false). */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

/** Should the chart animate value-change recomputes? Composes:
 *  - per-chart `animation` toggle
 *  - OS reduced-motion preference
 *  - WAAPI feature-detect (only matters when used, but exposed here for tests).
 */
export function shouldAnimate(perChartToggle: boolean): boolean {
  if (!perChartToggle) return false;
  if (prefersReducedMotion()) return false;
  if (typeof Element === 'undefined') return false;
  return typeof Element.prototype.animate === 'function';
}

/**
 * Animate a CSS-prop-style transition (opacity / transform) on a target node.
 * Falls back to instant set if any negative path fires.
 */
export function animateNode(
  node: Element | null,
  keyframes: Keyframe[] | PropertyIndexedKeyframes,
  options?: { duration?: number; easing?: string },
): void {
  if (!node) return;
  if (!shouldAnimate(true)) return;
  try {
    (node as HTMLElement | SVGElement).animate(keyframes, {
      duration: options?.duration ?? CHART_ANIMATION_MS,
      easing: options?.easing ?? 'ease-out',
      fill: 'forwards',
    });
  } catch {
    // swallow — snap-to-final-state degrade is acceptable
  }
}
