import { useRef } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';

gsap.registerPlugin(useGSAP);

/** Calm motion scale (seconds / px) — mirrors the CSS motion tokens in styles/index.css */
export const MOTION = { quick: 0.15, base: 0.25, distance: 8, stagger: 0.04, ease: 'power2.out' };

export const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** Slight rise for a view when `key` changes (route change). Avoids opacity so background tabs never leave a view washed out. */
export function useViewEnter(scopeRef, key) {
  useGSAP(
    () => {
      if (prefersReducedMotion() || !scopeRef.current) return;
      gsap.fromTo(
        scopeRef.current,
        { y: MOTION.distance },
        { y: 0, duration: MOTION.base, ease: MOTION.ease, clearProps: 'transform' }
      );
    },
    { dependencies: [key], scope: scopeRef }
  );
}

/**
 * Stagger children matching `selector` once `ready` turns true (e.g. after data loads).
 * Pure presentation: elements end at their natural state and inline styles are cleared.
 */
export function useStaggerIn(scopeRef, selector, ready = true, key = '') {
  useGSAP(
    () => {
      if (!ready || prefersReducedMotion() || !scopeRef.current) return;
      const items = scopeRef.current.querySelectorAll(selector);
      if (!items.length) return;
      gsap.fromTo(
        items,
        { autoAlpha: 0, y: MOTION.distance },
        { autoAlpha: 1, y: 0, duration: MOTION.base, ease: MOTION.ease, stagger: MOTION.stagger, clearProps: 'transform,visibility,opacity' }
      );
    },
    { dependencies: [ready, key], scope: scopeRef }
  );
}

/** Number that counts up to `value` (≤300ms). Always settles on format(value); static under reduced motion. */
export function CountUp({ value, format = (n) => String(n), className }) {
  const ref = useRef(null);
  useGSAP(
    () => {
      const el = ref.current;
      if (!el) return;
      const target = Number(value);
      if (!Number.isFinite(target) || prefersReducedMotion()) {
        el.textContent = format(value);
        return;
      }
      const state = { v: 0 };
      el.textContent = format(0);
      gsap.to(state, {
        v: target,
        duration: 0.3,
        ease: MOTION.ease,
        onUpdate: () => { el.textContent = format(Math.round(state.v)); },
        onComplete: () => { el.textContent = format(value); },
      });
    },
    { dependencies: [value], scope: ref }
  );
  return <span ref={ref} className={className} />;
}
