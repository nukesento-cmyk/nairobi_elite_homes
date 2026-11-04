import Image from "next/image";
import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { LOGO_HEIGHT, LOGO_WIDTH } from "@/config/brand";
import { primaryNav } from "@/config/nav";
import { site } from "@/config/site";
import { getCommunityCopy } from "@/content/community";
import { getCommunities } from "@/lib/cms";

import { JoinLink } from "./JoinLink";

const linkClass = "transition-colors hover:text-copper-400";
const headingClass = "mb-3 text-xs font-medium tracking-widest text-bone-200 uppercase";

export async function SiteFooter() {
  const { cta } = getCommunityCopy(site);
  const communities = await getCommunities();
  const { email, phone } = site.contact;

  return (
    // Extra space on phones so the floating button never covers footer links.
    <footer className="border-t border-border pb-24 md:pb-0">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr_1fr]">
        <div>
          <Image
            src="/brand/logo.svg"
            alt={site.name}
            width={LOGO_WIDTH}
            height={LOGO_HEIGHT}
            unoptimized
            className="h-24 w-auto"
          />
          <p className="mt-5 mb-6 max-w-sm text-sm text-bone-200">
            A private community for serious buyers, renters, sellers and landowners in
            Nairobi&apos;s premium areas.
          </p>
          <JoinLink source="footer" className={buttonVariants({ size: "cta" })}>
            {cta.long}
          </JoinLink>
        </div>

        {primaryNav.length > 0 && (
          <div>
            <h2 className={headingClass}>Explore</h2>
            <ul className="space-y-2 text-sm">
              {primaryNav.map((item) => (
                <li key={item.href}>
                  <Link href={item.href} className={linkClass}>
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div>
          <h2 className={headingClass}>Areas</h2>
          <ul className="space-y-2 text-sm">
            {communities.map((community) => (
              <li key={community.slug}>
                <Link href={`/communities/${community.slug}`} className={linkClass}>
                  {community.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {(email || phone) && (
          <div>
            <h2 className={headingClass}>Contact</h2>
            <ul className="space-y-2 text-sm">
              {email && (
                <li>
                  <a href={`mailto:${email}`} className={linkClass}>
                    {email}
                  </a>
                </li>
              )}
              {phone && (
                <li>
                  <a href={`tel:${phone}`} className={linkClass}>
                    {phone}
                  </a>
                </li>
              )}
            </ul>
          </div>
        )}

        {site.socials.length > 0 && (
          <div>
            <h2 className={headingClass}>Follow</h2>
            <ul className="space-y-2 text-sm">
              {site.socials.map((social) => (
                <li key={social.label}>
                  <a
                    href={social.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={linkClass}
                  >
                    {social.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
      <div className="mx-auto mt-10 flex max-w-7xl flex-wrap gap-6 px-4 text-sm sm:px-6">
        <Link href="/list-your-property" className={linkClass}>
          List your property
        </Link>
        <Link href="/privacy" className={linkClass}>
          Privacy policy
        </Link>
      </div>
    </footer>
  );
}
