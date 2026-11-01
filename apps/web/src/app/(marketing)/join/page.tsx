import { Check } from "lucide-react";
import type { Metadata } from "next";

import { JoinLink } from "@/components/marketing/JoinLink";
import { SocialProofLine } from "@/components/marketing/SocialProofLine";
import { SpotsProgress } from "@/components/marketing/SpotsProgress";
import { WhyJoinCards } from "@/components/marketing/WhyJoinCards";
import { buttonVariants } from "@/components/ui/button";
import { site } from "@/config/site";
import { getCommunityCopy } from "@/content/community";
import { testimonials } from "@/content/testimonials";
import { whyJoinCards } from "@/content/why-join";

const copy = getCommunityCopy(site);

export const metadata: Metadata = {
  title: "Join the community",
  description: copy.join.subhead,
};

export default function JoinPage() {
  const { join, cta } = copy;

  return (
    <>
      <section className="grain relative bg-linear-to-b from-forest-900 to-forest-950 py-section">
        <div className="relative mx-auto flex max-w-7xl flex-col items-start gap-8 px-4 sm:px-6">
          <p className="rounded-full border border-copper/50 px-3 py-1 text-xs font-medium tracking-widest text-copper-400 uppercase">
            {join.badge}
          </p>
          <h1 className="max-w-4xl text-display text-bone-50">{join.headline}</h1>
          <p className="max-w-2xl text-lg text-bone-200">{join.subhead}</p>
          <JoinLink
            source="join_page"
            placement="join_hero"
            className={buttonVariants({ size: "cta-lg", className: "w-full sm:w-auto" })}
          >
            {cta.long}
          </JoinLink>
          <SocialProofLine />
          <SpotsProgress />
        </div>
      </section>

      <section aria-labelledby="benefits" className="py-section">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 sm:px-6 md:grid-cols-2">
          <div>
            <h2 id="benefits" className="text-4xl text-bone-50 md:text-5xl">
              What you get
            </h2>
            <ul className="mt-8 space-y-4">
              {join.benefits.map((benefit) => (
                <li key={benefit} className="flex gap-3 text-lg text-bone-50">
                  <Check aria-hidden="true" className="mt-1 size-5 shrink-0 text-copper-400" />
                  {benefit}
                </li>
              ))}
            </ul>
          </div>
          <div className="self-start rounded-xl border border-copper/40 bg-forest-900/40 p-8">
            <h2 className="text-3xl text-bone-50">{join.offerTitle}</h2>
            <p className="mt-3 text-lg text-bone-200">{join.offerBody}</p>
          </div>
        </div>
      </section>

      <section aria-labelledby="problems" className="pb-section">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <h2 id="problems" className="mb-10 max-w-2xl text-4xl text-bone-50 md:text-5xl">
            The problems it solves
          </h2>
          <WhyJoinCards cards={whyJoinCards} sourcePrefix="join" placement="join_why_join" />
        </div>
      </section>

      {testimonials.length > 0 && (
        <section aria-labelledby="testimonials" className="pb-section">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <h2 id="testimonials" className="mb-10 text-4xl text-bone-50 md:text-5xl">
              From our members
            </h2>
            <ul className="grid gap-4 md:grid-cols-2 lg:gap-6">
              {testimonials.map((testimonial) => (
                <li key={testimonial.name} className="rounded-xl border border-border p-8">
                  <blockquote className="font-heading text-xl text-bone-50">
                    &ldquo;{testimonial.quote}&rdquo;
                  </blockquote>
                  <p className="mt-4 text-sm text-bone-200">
                    {testimonial.name}, {testimonial.role}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      <section className="grain relative bg-forest-900 py-section">
        <div className="relative mx-auto flex max-w-7xl flex-col items-start gap-8 px-4 sm:px-6">
          <h2 className="max-w-3xl text-4xl text-bone-50 md:text-5xl">{join.closingHeadline}</h2>
          <JoinLink
            source="join_page_closing"
            placement="join_closing"
            className={buttonVariants({ size: "cta-lg", className: "w-full sm:w-auto" })}
          >
            {cta.long}
          </JoinLink>
        </div>
      </section>
    </>
  );
}
