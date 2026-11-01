import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { primaryNav } from "@/config/nav";
import { site } from "@/config/site";
import { getCommunityCopy } from "@/content/community";

import { JoinLink } from "./JoinLink";
import { MobileMenu } from "./MobileMenu";

export function SiteHeader() {
  const { cta } = getCommunityCopy(site);

  return (
    <header className="relative border-b border-border">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-6 px-4 sm:px-6">
        <Link href="/" className="font-heading text-lg text-bone-50">
          {site.name}
        </Link>
        <div className="flex items-center gap-3 md:gap-6">
          {primaryNav.length > 0 && (
            <nav aria-label="Primary" className="hidden items-center gap-6 text-sm md:flex">
              {primaryNav.map((item) => (
                <Link key={item.href} href={item.href} className="hover:text-copper-400">
                  {item.label}
                </Link>
              ))}
            </nav>
          )}
          {/* On phones the strip and floating button already carry this CTA. */}
          <JoinLink
            source="header"
            className={buttonVariants({ size: "cta", className: "hidden sm:inline-flex" })}
          >
            {cta.short}
          </JoinLink>
          <MobileMenu items={primaryNav} />
        </div>
      </div>
    </header>
  );
}
