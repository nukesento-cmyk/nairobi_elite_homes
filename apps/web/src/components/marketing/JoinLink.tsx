"use client";

import type { ComponentProps } from "react";

import { track } from "@/lib/analytics";
import { joinLink } from "@/lib/whatsapp";

type JoinLinkProps = Omit<ComponentProps<"a">, "href" | "target" | "rel"> & {
  /** Which CTA this is. Must be unique so marketing can compare placements. */
  source: string;
  /** Where on the site it sits. */
  placement?: string;
};

export function JoinLink({ source, placement = "global", onClick, ...props }: JoinLinkProps) {
  return (
    <a
      {...props}
      href={joinLink(source)}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(event) => {
        track("join_click", { source, placement });
        onClick?.(event);
      }}
    />
  );
}
