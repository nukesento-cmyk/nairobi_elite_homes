import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  env: {
    // NEXT_PUBLIC_ values are written into the browser's JavaScript. Outside founding, the
    // invite must not be: blanking it here keeps it out of the bundle without anyone having
    // to remember, and reopening only takes switching the status back.
    NEXT_PUBLIC_WHATSAPP_GROUP_URL:
      process.env.NEXT_PUBLIC_COMMUNITY_STATUS === "founding"
        ? process.env.NEXT_PUBLIC_WHATSAPP_GROUP_URL
        : "",
  },
  /* config options here */
  images: {
    loader: "custom",
    loaderFile: "./src/lib/image-loader.ts",
  },
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
