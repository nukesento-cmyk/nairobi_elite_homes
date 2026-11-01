"use client";

import { useEffect, useRef, type ReactNode } from "react";

const STAGGER_MS = 100;

type ScrollRevealProps = {
  as?: "div" | "ul";
  className?: string;
  children: ReactNode;
};

function clear(item: HTMLElement) {
  delete item.dataset.reveal;
  item.style.removeProperty("--reveal-delay");
}

/**
 * Staggers the direct children in as they scroll into view.
 *
 * Only children still below the fold when this runs get hidden, so the server's
 * HTML stays fully visible, nothing above the fold flashes, and images that may
 * be the page's largest paint are never held back.
 */
export function ScrollReveal({ as: Tag = "div", className, children }: ScrollRevealProps) {
  const container = useRef<HTMLElement>(null);

  useEffect(() => {
    const root = container.current;
    if (!root) return;

    const items = Array.from(root.children).filter(
      (child): child is HTMLElement =>
        child instanceof HTMLElement && child.getBoundingClientRect().top > window.innerHeight,
    );

    const observer = new IntersectionObserver(
      (entries) => {
        let position = 0;
        for (const { isIntersecting, target } of entries) {
          if (!isIntersecting || !(target instanceof HTMLElement)) continue;
          observer.unobserve(target);
          target.style.setProperty("--reveal-delay", `${position++ * STAGGER_MS}ms`);
          target.dataset.reveal = "shown";
          // Hands transitions back to the element, so its hover lift isn't delayed.
          target.addEventListener("transitionend", () => clear(target), { once: true });
        }
      },
      { rootMargin: "0px 0px -8% 0px" },
    );

    for (const item of items) {
      item.dataset.reveal = "hidden";
      observer.observe(item);
    }

    return () => {
      observer.disconnect();
      items.forEach(clear);
    };
  }, []);

  return (
    <Tag ref={container as never} className={className}>
      {children}
    </Tag>
  );
}
