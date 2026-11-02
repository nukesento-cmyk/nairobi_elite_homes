"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, useEffect, useRef, useState, type CSSProperties, type PointerEvent } from "react";
import { buttonVariants } from "@/components/ui/button";
import { LOGO_HEIGHT, LOGO_WIDTH } from "@/config/brand";
import { primaryNav, areasNav } from "@/config/nav";
import { site } from "@/config/site";
import { getCommunityCopy } from "@/content/community";
import { JoinLink } from "./JoinLink";
import { MobileMenu } from "./MobileMenu";
import { cn } from "@/lib/utils";

const RIGHT_NAV = primaryNav.filter((i) => ["/homes", "/land"].includes(i.href));
const LEFT_NAV = primaryNav.filter((i) => !["/homes", "/land"].includes(i.href));

// Base link — resting visibility, hover lift, underline wipe, active underline.
// The `after` line is always present but transparent; active/hover just animate its width + opacity.
const linkClass =
  "group relative inline-flex items-center text-[13px] tracking-wide text-bone-100 " +
  "transition-[color,translate] duration-200 ease-out motion-safe:hover:-translate-y-px hover:text-copper-400 " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-copper-400 " +
  "focus-visible:ring-offset-2 focus-visible:ring-offset-background " +
  "after:absolute after:-bottom-1 after:left-0 after:h-[1.5px] after:w-0 after:bg-copper-400 " +
  "after:opacity-0 after:transition-all after:duration-200 hover:after:w-full hover:after:opacity-100";

// Applied when the route matches. Overrides the after-line to be full-width + visible.
const activeClass =
  "text-copper-400 after:w-full after:opacity-100 " +
  "before:absolute before:-left-2 before:top-1/2 before:size-1 before:-translate-y-1/2 " +
  "before:rounded-full before:bg-copper-400 before:content-['']";

// Reads the path, so it needs its own boundary, or dynamic pages return a 500 after a publish.
// See JoinLink. Until it reports, nothing is highlighted, which is all a shell can know.
function PathReporter({ onChange }: { onChange: (path: string) => void }) {
  const path = usePathname();
  useEffect(() => onChange(path), [onChange, path]);
  return null;
}

// A fade done purely in CSS: links still show without JavaScript, and it's skipped for
// anyone who prefers reduced motion. See .nav-reveal in globals.css.
const revealStyle = (index: number) => ({ "--reveal-index": index }) as CSSProperties;

export function SiteHeader() {
  const { cta } = getCommunityCopy(site);
  const [pathname, setPathname] = useState("");
  const [scrolled, setScrolled] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [areasOpen, setAreasOpen] = useState(false);
  const lastY = useRef(0);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Hides on the way down and returns on the way up.
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

  // Helper: is this href the current route (or a parent of it)?
  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + "/");

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
      <Suspense>
        <PathReporter onChange={setPathname} />
      </Suspense>
      <div className="relative mx-auto flex h-(--header-h) max-w-7xl items-center justify-between gap-6 px-4 sm:px-6">
        {/* LEFT — brand/action links */}
        <nav
          aria-label="Primary left"
          className="hidden items-center gap-6 lg:flex"
        >
          {LEFT_NAV.map((item, i) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                style={revealStyle(i)}
                className={cn("nav-reveal", linkClass, active && activeClass)}
              >
                {item.label}
              </Link>
            );
          })}
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

        {/* RIGHT — discovery links + Areas + CTA */}
        <div className="ml-auto flex items-center gap-3 md:gap-6">
          <nav
            aria-label="Primary right"
            className="hidden items-center gap-6 lg:flex"
          >
            {RIGHT_NAV.map((item, i) => {
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  style={revealStyle(LEFT_NAV.length + i)} // continue the stagger
                  className={cn("nav-reveal", linkClass, active && activeClass)}
                >
                  {item.label}
                </Link>
              );
            })}

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
                style={revealStyle(LEFT_NAV.length + RIGHT_NAV.length)}
                className={cn(
                  "nav-reveal",
                  linkClass,
                  "gap-1",
                  isActive("/areas") && activeClass
                )}
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
                  className="absolute right-0 top-full mt-3 w-[420px] rounded-lg border border-border bg-background/95 p-5 shadow-xl backdrop-blur-md"
                >
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-bone-200">
                    Areas
                  </p>
                  <ul className="divide-y divide-border/60">
                    {areasNav.map((area) => {
                      const active = isActive(area.href);
                      return (
                        <li key={area.href}>
                          <Link
                            href={area.href}
                            role="menuitem"
                            onClick={closeAreasNow}
                            aria-current={active ? "page" : undefined}
                            className="group -mx-2 flex items-baseline justify-between gap-6 rounded px-2 py-2 transition-colors hover:bg-bone-50/5"
                          >
                            <span
                              className={cn(
                                "text-[13px] transition-colors",
                                active
                                  ? "text-copper-400"
                                  : "text-bone-50 group-hover:text-copper-400"
                              )}
                            >
                              {area.label}
                            </span>
                            <span className="text-xs text-bone-200">
                              {area.description}
                            </span>
                          </Link>
                        </li>
                      );
                    })}
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