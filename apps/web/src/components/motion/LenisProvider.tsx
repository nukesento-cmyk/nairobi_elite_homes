"use client";

import Lenis from "lenis";
import { useEffect, type ReactNode } from "react";

import { useReducedMotion } from "./useReducedMotion";

export function LenisProvider({ children }: { children: ReactNode }) {
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    if (reducedMotion) return;
    const lenis = new Lenis({ autoRaf: true });
    return () => lenis.destroy();
  }, [reducedMotion]);

  return children;
}
