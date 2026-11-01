import { buttonVariants } from "@/components/ui/button";
import { site } from "@/config/site";
import { getCommunityCopy } from "@/content/community";

import { JoinLink } from "./JoinLink";
import { SocialProofLine } from "./SocialProofLine";

// The README's cinematic image goes here once a licensed photo is available.
export function HomeHero() {
  const copy = getCommunityCopy(site);

  return (
    <section className="grain relative bg-linear-to-b from-forest-900 to-forest-950 py-section">
      <div className="relative mx-auto max-w-7xl px-4 sm:px-6">
        <h1 className="max-w-4xl text-display text-bone-50">
          Private access to Nairobi&apos;s most sought-after homes and land.
        </h1>
        <p className="mt-6 max-w-xl text-lg text-bone-200">
          Karen, Runda, Kilimani, Rosslyn, Lavington and Muthaiga. {copy.heroAccess}
        </p>
        <div className="mt-10 flex flex-col gap-3 sm:flex-row">
          <JoinLink
            source="hero"
            placement="home_hero"
            className={buttonVariants({ size: "cta-lg" })}
          >
            {copy.cta.long}
          </JoinLink>
          <a
            href="#listings"
            className={buttonVariants({
              variant: "outline",
              size: "cta-lg",
              className: "bg-transparent",
            })}
          >
            Browse listings
          </a>
        </div>
        <div className="mt-8">
          <SocialProofLine />
        </div>
      </div>
    </section>
  );
}
