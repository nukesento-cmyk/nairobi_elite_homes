import { getSocialProofItems } from "@/content/community";
import { getLiveSite } from "@/lib/cms";

export async function SocialProofLine() {
  const items = getSocialProofItems(await getLiveSite());
  if (items.length === 0) return null;

  return <p className="text-sm text-bone-200">{items.join(" · ")}</p>;
}
