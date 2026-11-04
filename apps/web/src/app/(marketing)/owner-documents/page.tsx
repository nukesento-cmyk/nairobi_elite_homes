import type { Metadata } from "next";
import Link from "next/link";

import { OwnerDocumentsForm } from "@/components/marketing/OwnerDocumentsForm";

// Not for search engines. The link's secret sits after the #, so browsers never send it to any
// server, log or analytics tool. Only the upload itself carries it, in the request body.
export const metadata: Metadata = {
  title: "Send your documents",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default function OwnerDocumentsPage() {
  return (
    <section className="mx-auto max-w-2xl px-4 py-14 sm:px-6 md:py-20">
      <h1 className="text-5xl text-bone-50 md:text-6xl">Send your documents</h1>
      <p className="mt-4 mb-8 text-lg text-bone-200">
        We need these to confirm your identity and your right to market the property. They&apos;re encrypted and stored privately, only our verification team can open them, and we delete them once they&apos;re no longer needed. See our <Link href="/privacy" className="text-copper-400 underline underline-offset-4">privacy policy</Link>.
      </p>
      <OwnerDocumentsForm />
    </section>
  );
}
