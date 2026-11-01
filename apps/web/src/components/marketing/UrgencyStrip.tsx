import { getCommunityCopy } from "@/content/community";
import { getLiveSite } from "@/lib/cms";
import { cn } from "@/lib/utils";
import { restoreDismissalScript } from "@/lib/strip-dismissal";

import { JoinLink } from "./JoinLink";
import { StripDismissButton } from "./StripDismissButton";

export async function UrgencyStrip() {
  const { strip } = getCommunityCopy(await getLiveSite());

  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: restoreDismissalScript }} />
      <aside
        data-urgency-strip
        aria-label="Community announcement"
        className="sticky top-0 z-50 flex h-10 items-center gap-2 border-b border-copper/30 bg-forest-950 pr-1 pl-4 text-[0.8125rem] text-copper-400"
      >
        <p className="flex min-w-0 flex-1 items-center justify-center gap-[0.35em] whitespace-nowrap">
          {strip.showStatusDot && <span aria-hidden="true">🟢</span>}
          <span className={cn(strip.hideLeadOnPhones && "hidden sm:inline")}>{strip.lead}</span>
          {strip.highlight && <strong className="font-medium">{strip.highlight}</strong>}
          {strip.tail && <span className="hidden md:inline">{strip.tail}</span>}
          {strip.arrow === "before-cta" && <span aria-hidden="true">→</span>}
          <JoinLink
            source="top_strip"
            className="font-medium text-bone-50 underline decoration-copper underline-offset-4"
          >
            {strip.cta}
          </JoinLink>
          {strip.arrow === "after-cta" && <span aria-hidden="true">→</span>}
        </p>
        <StripDismissButton />
      </aside>
    </>
  );
}
