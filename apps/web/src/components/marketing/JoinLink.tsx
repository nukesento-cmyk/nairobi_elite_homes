"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, type ComponentProps } from "react";

import { site } from "@/config/site";
import { track } from "@/lib/analytics";
import { joinLink } from "@/lib/whatsapp";

type JoinLinkProps = Omit<ComponentProps<"a">, "href" | "target" | "rel"> & {
  /** Which CTA this is. Must be unique so marketing can compare placements. */
  source: string;
  /** Where on the site it sits. */
  placement?: string;
};

function JoinAnchor({
  source,
  placement = "global",
  onClick,
  onJoinPage,
  ...props
}: JoinLinkProps & { onJoinPage: boolean }) {
  const href = joinLink(source, onJoinPage);
  const handleClick: JoinLinkProps["onClick"] = (event) => {
    track("join_click", { source, placement });
    onClick?.(event);
  };

  if (href.startsWith("/")) {
    return <Link {...props} href={href} onClick={handleClick} />;
  }
  return <a {...props} href={href} target="_blank" rel="noopener noreferrer" onClick={handleClick} />;
}

function PathAwareJoinLink(props: JoinLinkProps) {
  return <JoinAnchor {...props} onJoinPage={usePathname() === "/join"} />;
}

export function JoinLink(props: JoinLinkProps) {
  // During founding every CTA goes to the group, so the current path doesn't matter.
  if (site.community.status === "founding") return <JoinAnchor {...props} onJoinPage={false} />;

  // usePathname() outside Suspense makes Next.js return a 500 when it regenerates
  // a dynamic route's shell, which happens after every CMS publish.
  return (
    <Suspense fallback={<JoinAnchor {...props} onJoinPage={false} />}>
      <PathAwareJoinLink {...props} />
    </Suspense>
  );
}
