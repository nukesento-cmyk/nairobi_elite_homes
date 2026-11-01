import { site } from "@/config/site";
import { getSocialProofItems } from "@/content/community";

export function SocialProofLine() {
  const items = getSocialProofItems(site);
  if (items.length === 0) return null;

  return <p className="text-sm text-bone-200">{items.join(" · ")}</p>;
}
