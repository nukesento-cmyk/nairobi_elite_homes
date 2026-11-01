"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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
  const href = joinLink(source, usePathname() === "/join");
  const handleClick: JoinLinkProps["onClick"] = (event) => {
    track("join_click", { source, placement });
    onClick?.(event);
  };

  if (href.startsWith("/")) {
    return <Link {...props} href={href} onClick={handleClick} />;
  }
  return <a {...props} href={href} target="_blank" rel="noopener noreferrer" onClick={handleClick} />;
}
