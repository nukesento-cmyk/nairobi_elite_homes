"use client";

import Lenis from "lenis";
import { useEffect, type ReactNode } from "react";

import { useReducedMotion } from "./useReducedMotion";

export function LenisProvider({ children }: { children: ReactNode }) {
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    if (reducedMotion) return;
    // Without these, the glide after a wheel gesture overwrites the jump to a new
    // page's top, or to the skip link's target, for about a second.
    const lenis = new Lenis({ autoRaf: true, stopInertiaOnNavigate: true, anchors: true });
    // The browser's back and forward buttons aren't clicks, so the option above misses them.
    const stopGlide = () => lenis.scrollTo(window.scrollY, { immediate: true, force: true });
    window.addEventListener("popstate", stopGlide);
    return () => {
      window.removeEventListener("popstate", stopGlide);
      lenis.destroy();
    };
  }, [reducedMotion]);

  return children;
}
