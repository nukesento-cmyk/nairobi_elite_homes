import { buttonVariants } from "@/components/ui/button";
import { site } from "@/config/site";
import { getCommunityCopy } from "@/content/community";

import { JoinLink } from "./JoinLink";

export function JoinInterstitial() {
  const { cta, interstitial } = getCommunityCopy(site);

  return (
    <div className="grain relative col-span-full overflow-hidden rounded-xl border border-copper/40 bg-card p-8 md:p-10">
      <div className="relative flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="font-heading text-2xl text-bone-50 md:text-3xl">
            {interstitial.headline}
          </p>
          <p className="mt-2 text-bone-200">
            {interstitial.body}
          </p>
        </div>
        <JoinLink
          source="interstitial"
          placement="listing_grid"
          className={buttonVariants({ size: "cta", className: "shrink-0" })}
        >
          {cta.long}
        </JoinLink>
      </div>
    </div>
  );
}
