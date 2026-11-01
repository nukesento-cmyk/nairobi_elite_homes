import { Clock, MapPinned, Phone, Scale, ShieldCheck, Users, type LucideIcon } from "lucide-react";

import type { WhyJoinCard, WhyJoinIcon } from "@/content/why-join";

import { JoinLink } from "./JoinLink";

const icons: Record<WhyJoinIcon, LucideIcon> = {
  clock: Clock,
  shield: ShieldCheck,
  map: MapPinned,
  phone: Phone,
  scale: Scale,
  users: Users,
};

type WhyJoinCardsProps = {
  cards: WhyJoinCard[];
  /** Prefixed to each card's source, so the same card is tracked separately per page. */
  sourcePrefix: string;
  placement: string;
};

export function WhyJoinCards({ cards, sourcePrefix, placement }: WhyJoinCardsProps) {
  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:gap-6">
      {cards.map((card) => {
        const Icon = icons[card.icon];
        return (
          <li
            key={card.ctaSource}
            className="flex flex-col rounded-xl border border-border bg-forest-900/40 p-6 lg:p-8"
          >
            <Icon aria-hidden="true" strokeWidth={1.5} className="size-6 text-copper-400" />
            <h3 className="mt-5 text-2xl text-bone-50">{card.title}</h3>
            <p className="mt-3 text-bone-200">{card.problem}</p>
            <p className="mt-2 mb-6 text-bone-50">{card.solution}</p>
            <JoinLink
              source={`${sourcePrefix}_${card.ctaSource}`}
              placement={placement}
              className="mt-auto w-fit text-sm font-medium text-copper-400 underline decoration-copper/50 underline-offset-4 transition-colors hover:text-bone-50"
            >
              {card.ctaLabel} <span aria-hidden="true">→</span>
            </JoinLink>
          </li>
        );
      })}
    </ul>
  );
}
