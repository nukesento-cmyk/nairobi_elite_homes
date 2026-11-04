import Image from "next/image";
import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";

import type { BrandSite } from "@/lib/brand-site-data";
import { chatWithNumber } from "@/lib/whatsapp";

const LOGO_HEIGHT = 48;
const LOGO_WIDTH = 160;

/** Everything accented on the page reads these, so one colour rebrands the whole site. */
function accentStyle(accent: string | null): CSSProperties | undefined {
  if (!accent) return undefined;
  return {
    "--color-copper": accent,
    "--color-copper-400": accent,
    "--color-copper-600": `color-mix(in srgb, ${accent} 85%, black)`,
    "--primary": accent,
    "--ring": accent,
  } as CSSProperties;
}

export function brandChatLink(site: BrandSite, message: string): string | null {
  return site.whatsappPhone ? chatWithNumber(site.whatsappPhone, message) : null;
}

export function BrandShell({ site, children }: { site: BrandSite; children: ReactNode }) {
  const nav = [
    { label: "Homes", href: `${site.base}/homes` },
    { label: "Land", href: `${site.base}/land` },
    { label: "Blog", href: `${site.base}/blog` },
    { label: "Join", href: `${site.base}/join` },
    { label: "Contact", href: `${site.base}/contact` },
    { label: "Sign in", href: `${site.base}/login` },
  ];
  const chat = brandChatLink(site, `Hi ${site.name}, I'd like to know more.`);

  return (
    <div style={accentStyle(site.accentColor)} className="flex min-h-full flex-1 flex-col">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-x-8 gap-y-3 px-4 py-4 sm:px-6">
          <Link href={site.base || "/"} className="text-2xl text-bone-50">
            {site.logoUrl ? (
              <Image
                src={site.logoUrl}
                alt={site.name}
                width={LOGO_WIDTH}
                height={LOGO_HEIGHT}
                preload
                className="h-12 w-auto max-w-40 object-contain"
              />
            ) : (
              site.name
            )}
          </Link>
          <nav aria-label="Main" className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-bone-100">
            {nav.map(({ label, href }) => (
              <Link key={href} href={href} className="underline-draw hover:text-bone-50">
                {label}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      <main id="main" className="flex-1">
        {children}
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-7xl flex-wrap justify-between gap-6 px-4 py-10 text-sm text-bone-200 sm:px-6">
          <div>
            <p className="text-lg text-bone-50">{site.name}</p>
            {site.tagline && <p className="mt-1 max-w-md">{site.tagline}</p>}
          </div>
          <ul className="space-y-2">
            {site.contactEmail && (
              <li>
                <a href={`mailto:${site.contactEmail}`} className="hover:text-bone-50">{site.contactEmail}</a>
              </li>
            )}
            {site.contactPhone && (
              <li>
                <a href={`tel:${site.contactPhone}`} className="hover:text-bone-50">{site.contactPhone}</a>
              </li>
            )}
            {chat && (
              <li>
                <a href={chat} target="_blank" rel="noopener noreferrer" className="hover:text-bone-50">WhatsApp</a>
              </li>
            )}
            <li>
              <Link href={`${site.base}/privacy`} className="hover:text-bone-50">Privacy policy</Link>
            </li>
          </ul>
        </div>
      </footer>
    </div>
  );
}
