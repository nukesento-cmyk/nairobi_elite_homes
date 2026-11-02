"use client";

import { Menu, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import type { AreaItem, NavItem } from "@/config/nav";

import { JoinLink } from "./JoinLink";

type Props = {
  items: NavItem[];
  areas: AreaItem[];
  ctaLabel: string;
};

const linkBase =
  "block rounded text-bone-50 transition-colors hover:text-copper-400 " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-copper-400 " +
  "focus-visible:ring-offset-2 focus-visible:ring-offset-forest-950";

export function MobileMenu({ items, areas, ctaLabel }: Props) {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLElement | null>(null);
  const toggleRef = useRef<HTMLButtonElement | null>(null);
  const close = () => setOpen(false);

  useEffect(() => {
    if (!open) return;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        toggleRef.current?.focus();
      }
    };
    const closeMenu = () => setOpen(false);
    // Rotating to the desktop layout hides this menu, which would leave the page locked.
    const desktop = window.matchMedia("(min-width: 1024px)");

    window.addEventListener("keydown", onKey);
    window.addEventListener("popstate", closeMenu);
    desktop.addEventListener("change", closeMenu);

    panelRef.current?.querySelector<HTMLElement>("a, button")?.focus();

    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("popstate", closeMenu);
      desktop.removeEventListener("change", closeMenu);
    };
  }, [open]);

  return (
    <div className="lg:hidden">
      <button
        ref={toggleRef}
        type="button"
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        aria-controls="mobile-menu"
        onClick={() => setOpen((v) => !v)}
        className="flex size-11 items-center justify-center rounded-md text-bone-50 focus-visible:outline-2 focus-visible:outline-copper-400"
      >
        {open ? (
          <X aria-hidden="true" className="size-6" />
        ) : (
          <Menu aria-hidden="true" className="size-6" />
        )}
      </button>

      {open && (
        <>
          {/* data-lenis-prevent hands scrolling back to the browser, whose scroll lock
              applies. Lenis would otherwise keep scrolling the page behind the menu. */}
          <div
            aria-hidden="true"
            data-lenis-prevent
            onClick={close}
            className="absolute inset-x-0 top-full z-30 h-dvh bg-forest-950/70"
          />
          <nav
            id="mobile-menu"
            ref={panelRef}
            aria-label="Mobile"
            data-lenis-prevent
            className="absolute inset-x-0 top-full z-40 flex max-h-[calc(100dvh-var(--strip-h)-var(--header-h))] flex-col border-b border-border bg-forest-950"
          >
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
              <ul className="px-4 pt-2">
                {items.map((item) => (
                  <li key={item.href}>
                    <Link href={item.href} onClick={close} className={`${linkBase} py-3 text-lg`}>
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>

              {areas.length > 0 && (
                <div className="mt-2 border-t border-border/60 px-4">
                  <p className="pt-4 pb-2 text-[11px] font-semibold tracking-widest text-bone-200 uppercase">
                    Areas
                  </p>
                  <ul className="divide-y divide-border/40">
                    {areas.map((area) => (
                      <li key={area.href}>
                        <Link
                          href={area.href}
                          onClick={close}
                          className={`${linkBase} py-2.5 text-[15px]`}
                        >
                          {area.label}
                          <span className="text-bone-200"> — {area.description}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                  <Link
                    href="/areas"
                    onClick={close}
                    className="inline-block py-3 text-sm text-copper-400 hover:text-bone-50"
                  >
                    View all areas →
                  </Link>
                </div>
              )}
            </div>

            <div className="shrink-0 border-t border-border/60 p-4">
              <JoinLink
                source="mobile_menu"
                placement="mobile_menu"
                onClick={close}
                className="block w-full rounded-md border border-copper-400/40 py-3 text-center text-sm text-copper-400 hover:bg-copper-400/10"
              >
                {ctaLabel}
              </JoinLink>
            </div>
          </nav>
        </>
      )}
    </div>
  );
}
