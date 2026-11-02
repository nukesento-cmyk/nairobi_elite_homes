"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState, type PointerEvent } from "react";
import { buttonVariants } from "@/components/ui/button";
import { LOGO_HEIGHT, LOGO_WIDTH } from "@/config/brand";
import { primaryNav, areasNav } from "@/config/nav";
import { site } from "@/config/site";
import { getCommunityCopy } from "@/content/community";
import { JoinLink } from "./JoinLink";
import { MobileMenu } from "./MobileMenu";
import { cn } from "@/lib/utils";

const LEFT = primaryNav.filter((i) => ["/homes", "/land"].includes(i.href));
const RIGHT = primaryNav.filter((i) => !["/homes", "/land"].includes(i.href));
const linkClass =
  "relative text-[13px] tracking-wide text-bone-100 transition-colors hover:text-copper-400 " +
  "after:absolute after:-bottom-1 after:left-0 after:h-[1.5px] after:w-0 after:bg-copper-400 " +
  "after:transition-all hover:after:w-full focus-visible:outline-none focus-visible:ring-2 " +
  "focus-visible:ring-copper-400 focus-visible:ring-offset-2 focus-visible:ring-offset-background";

export function SiteHeader() {
  const { cta } = getCommunityCopy(site);
  const [scrolled, setScrolled] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [areasOpen, setAreasOpen] = useState(false);
  const lastY = useRef(0);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Hides on the way down and returns on the way up. The distance is measured from the
  // last change, because Lenis scrolls a few pixels a frame and no single step is large.
  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      setScrolled(y > 8);
      if (areasOpen) {
        lastY.current = y;
        return;
      }
      const delta = y - lastY.current;
      if (y < 80) {
        setHidden(false);
        lastY.current = y;
      } else if (delta > 64) {
        setHidden(true);
        lastY.current = y;
      } else if (delta < -8) {
        setHidden(false);
        lastY.current = y;
      }
    };
    // Picks up a page reloaded part-way down.
    const frame = requestAnimationFrame(onScroll);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
    };
  }, [areasOpen]);

  // Esc closes
  useEffect(() => {
    const onKey = (e: KeyboardEvent) =>
      e.key === "Escape" && setAreasOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Mouse only. On a touch screen a tap fires both hover and click, which would
  // open the panel and immediately toggle it shut.
  const openAreas = (e: PointerEvent) => {
    if (e.pointerType !== "mouse") return;
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    setAreasOpen(true);
  };
  const closeAreas = (e: PointerEvent) => {
    if (e.pointerType !== "mouse") return;
    hoverTimer.current = setTimeout(() => setAreasOpen(false), 150);
  };
  const closeAreasNow = () => setAreasOpen(false);

  return (
    <header
      className={cn(
        "group/header fixed inset-x-0 top-(--strip-h) z-40 transition-[transform,background-color,box-shadow] duration-200",
        "ease-out focus-within:translate-y-0 has-[#mobile-menu]:bg-forest-950 motion-reduce:transition-none",
        scrolled
          ? "border-b border-border bg-background/80 backdrop-blur-md shadow-[0_1px_0_0_rgba(255,255,255,0.03)]"
          : "border-b border-transparent bg-transparent",
        hidden ? "-translate-y-full" : "translate-y-0"
      )}
    >
      <div className="relative mx-auto flex h-(--header-h) max-w-7xl items-center justify-between gap-6 px-4 sm:px-6">
        {/* LEFT */}
        <nav
          aria-label="Primary left"
          className="hidden items-center gap-6 lg:flex"
        >
          {LEFT.map((item) => (
            <Link key={item.href} href={item.href} className={linkClass}>
              {item.label}
            </Link>
          ))}

          {/* AREAS */}
          <div
            className="relative"
            onPointerEnter={openAreas}
            onPointerLeave={closeAreas}
            onBlur={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget)) closeAreasNow();
            }}
          >
            <button
              type="button"
              aria-haspopup="true"
              aria-expanded={areasOpen}
              onClick={() => setAreasOpen((v) => !v)}
              className={cn(linkClass, "inline-flex items-center gap-1")}
            >
              Areas
              <svg
                width="10"
                height="10"
                viewBox="0 0 10 10"
                aria-hidden="true"
                className={cn(
                  "transition-transform",
                  areasOpen && "rotate-180"
                )}
              >
                <path
                  d="M1 3l4 4 4-4"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  fill="none"
                />
              </svg>
            </button>

            {areasOpen && (
              <div
                role="menu"
                className="absolute left-0 top-full mt-3 w-[420px] rounded-lg border border-border bg-background/95 p-5 shadow-xl backdrop-blur-md"
              >
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-bone-200">
                  Areas
                </p>
                <ul className="divide-y divide-border/60">
                  {areasNav.map((area) => (
                    <li key={area.href}>
                      <Link
                        href={area.href}
                        role="menuitem"
                        onClick={closeAreasNow}
                        className="group -mx-2 flex items-baseline justify-between gap-6 rounded px-2 py-2 hover:bg-bone-50/5"
                      >
                        <span className="text-[13px] text-bone-50 transition-colors group-hover:text-copper-400">
                          {area.label}
                        </span>
                        <span className="text-xs text-bone-200">
                          {area.description}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
                <div className="mt-3 border-t border-border/60 pt-3">
                  <Link
                    href="/areas"
                    onClick={closeAreasNow}
                    className="text-xs text-copper-400 hover:text-bone-50"
                  >
                    View all areas →
                  </Link>
                </div>
              </div>
            )}
          </div>
        </nav>

        {/* Centred logo */}
        <Link
          href="/"
          aria-label={site.name}
          className="absolute top-1 left-1/2 -translate-x-1/2 transition-opacity hover:opacity-80"
        >
          <Image
            src="/brand/logo.svg"
            alt=""
            width={LOGO_WIDTH}
            height={LOGO_HEIGHT}
            unoptimized
            // Hangs below the bar at the top of the page, and eases back inside it once
            // the bar sits over content or the mobile menu opens. The shadow keeps it
            // readable where it overlaps a bright photo.
            className={cn(
              "h-[88px] w-auto origin-top drop-shadow-[0_1px_6px_var(--color-forest-950)] transition-transform duration-300 ease-out group-has-[#mobile-menu]/header:scale-70 motion-reduce:transition-none md:h-[112px]",
              scrolled && "scale-70",
            )}
          />
        </Link>

        {/* RIGHT. ml-auto keeps it here when the left nav is hidden on smaller screens. */}
        <div className="ml-auto flex items-center gap-3 md:gap-6">
          <nav
            aria-label="Primary right"
            className="hidden items-center gap-6 lg:flex"
          >
            {RIGHT.map((item) => (
              <Link key={item.href} href={item.href} className={linkClass}>
                {item.label}
              </Link>
            ))}
          </nav>
          <JoinLink
            source="header"
            className={buttonVariants({
              variant: "outline",
              size: "cta",
              className:
                "hidden sm:inline-flex border-copper-400/40 text-copper-400 hover:bg-copper-400/10",
            })}
          >
            {cta.short}
          </JoinLink>
          <MobileMenu items={primaryNav} areas={areasNav} ctaLabel={cta.short} />
        </div>
      </div>
    </header>
  );
}
