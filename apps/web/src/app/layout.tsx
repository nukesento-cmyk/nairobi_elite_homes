import type { Metadata } from "next";
import { Fraunces, Inter, Madimi_One } from "next/font/google";
import type { ReactNode } from "react";

import { LenisProvider } from "@/components/motion/LenisProvider";
import { site } from "@/config/site";

import "./globals.css";

// next/font downloads these at build time and serves them from this site.
const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  weight: ["400", "600"],
  display: "swap",
});

// The logo only.
const madimi = Madimi_One({
  variable: "--font-madimi",
  subsets: ["latin"],
  weight: "400",
  display: "swap",
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: site.url ? new URL(site.url) : undefined,
  title: { default: site.name, template: `%s | ${site.name}` },
  description:
    "A private community for serious buyers, renters, sellers and landowners in Nairobi's premium areas.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    // The strip's pre-paint script can set a data attribute on <html> before hydration.
    <html
      lang="en"
      suppressHydrationWarning
      className={`${fraunces.variable} ${inter.variable} ${madimi.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <LenisProvider>{children}</LenisProvider>
      </body>
    </html>
  );
}
