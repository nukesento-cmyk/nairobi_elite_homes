import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { getCommunityCopy } from "@/content/community";
import { getLiveSite, getSiteMedia } from "@/lib/cms";
import { cn } from "@/lib/utils";

import { HeroMedia } from "./HeroMedia";
import { JoinLink } from "./JoinLink";
import { SocialProofLine } from "./SocialProofLine";

// Without a photo in Site Media, the hero is a plain gradient.
export async function HomeHero() {
  const [live, { heroExterior, heroInterior }] = await Promise.all([getLiveSite(), getSiteMedia()]);
  const copy = getCommunityCopy(live);

  return (
    <section
      className={cn(
        "grain relative overflow-hidden bg-linear-to-b from-forest-900 to-forest-950 py-section",
        // Runs up under the header, which is transparent at the top of the page.
        heroExterior && "-mt-(--header-h) flex min-h-[85svh] items-end",
      )}
    >
      {heroExterior && (
        <>
          <HeroMedia exterior={heroExterior} interior={heroInterior} />
          {/* Keeps the text readable over any photo, even a white one. */}
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-forest-950/80 md:bg-transparent md:bg-linear-to-r md:from-forest-950/85 md:via-forest-950/75 md:to-forest-950/30"
          />
        </>
      )}
      <div className="relative mx-auto w-full max-w-7xl px-4 sm:px-6">
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
          <Link
            href="/homes"
            className={buttonVariants({
              variant: "outline",
              size: "cta-lg",
              className: "bg-transparent",
            })}
          >
            Browse listings
          </Link>
        </div>
        <div className="mt-8">
          <SocialProofLine />
        </div>
      </div>
    </section>
  );
}
