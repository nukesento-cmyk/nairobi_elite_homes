import { ImageResponse } from "next/og";

import { colors } from "@/config/design-tokens";
import { site } from "@/config/site";
import { getListing } from "@/lib/cms";
import { formatPrice, formatSpecs } from "@/lib/listings";

// Only draws public listings looked up by slug, never text from the URL, so this
// can't reveal a gated listing or be used to generate arbitrary images.
export async function GET(request: Request) {
  const slug = new URL(request.url).searchParams.get("slug");
  const listing = slug ? await getListing(slug) : null;
  if (!listing) return new Response("Not found", { status: 404 });

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: 72,
        color: colors.bone[50],
        backgroundImage: `linear-gradient(160deg, ${colors.forest[900]}, ${colors.forest[950]})`,
      }}
    >
      <div style={{ display: "flex", fontSize: 32, color: colors.copper[400] }}>{site.name}</div>
      <div style={{ display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", fontSize: 32, color: colors.bone[200] }}>
          {listing.area}, Nairobi
        </div>
        <div style={{ display: "flex", fontSize: 76, lineHeight: 1.1, marginTop: 12 }}>
          {listing.title}
        </div>
        <div style={{ display: "flex", fontSize: 36, marginTop: 28, color: colors.copper[400] }}>
          {[formatPrice(listing.price), formatSpecs(listing.specs)].filter(Boolean).join("  ·  ")}
        </div>
      </div>
    </div>,
    { width: 1200, height: 630 },
  );
}
