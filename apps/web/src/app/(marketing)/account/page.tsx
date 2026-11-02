import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { GoogleButton } from "@/components/GoogleButton";
import { buttonVariants } from "@/components/ui/button";
import { getCurrentBuyer } from "@/lib/auth/buyer-session";
import { isGoogleConfigured } from "@/lib/auth/google";
import { isDatabaseConfigured } from "@/lib/db";

import { buyerSignOut } from "./actions";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to NairobiEliteHomes for free with your Google account.",
  robots: { index: false, follow: false },
};

const ERRORS: Record<string, string> = {
  "google-failed": "Google sign-in didn't complete. Please try again.",
  "not-configured": "Sign-in isn't available yet.",
};

async function AccountContent({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const [{ error }, buyer] = await Promise.all([searchParams, getCurrentBuyer()]);

  if (buyer) {
    return (
      <>
        <h1 className="text-4xl text-bone-50">Welcome, {buyer.name}</h1>
        <p className="mt-2 text-bone-200">Signed in as {buyer.email}</p>
        <div className="mt-8 rounded-xl border border-border p-6">
          <h2 className="text-2xl text-bone-50">Your free account</h2>
          <p className="mt-2 text-bone-200">
            Browse every public home and land listing. The private community is closed and isn&apos;t
            part of a free account. To get the link, contact an admin.
          </p>
          <Link href="/join#request-access" className={buttonVariants({ size: "cta", className: "mt-5 w-full" })}>
            Contact an admin
          </Link>
          <div className="mt-5 flex flex-wrap gap-5 text-copper-400">
            <Link href="/homes" className="underline underline-offset-4">Homes</Link>
            <Link href="/land" className="underline underline-offset-4">Land</Link>
            <Link href="/blog" className="underline underline-offset-4">Blog</Link>
          </div>
        </div>
        <form action={buyerSignOut} className="mt-6">
          <button type="submit" className="text-sm text-bone-200 underline underline-offset-4">
            Sign out
          </button>
        </form>
      </>
    );
  }

  const available = isGoogleConfigured() && isDatabaseConfigured();
  return (
    <>
      <h1 className="text-4xl text-bone-50">Sign in</h1>
      <p className="mt-2 mb-8 text-bone-200">Free, with your Google account. There&apos;s no password to remember.</p>
      {error && ERRORS[error] && (
        <p role="alert" className="mb-4 text-sm text-terracotta">{ERRORS[error]}</p>
      )}
      {available ? <GoogleButton audience="buyer" /> : <p className="text-bone-200">Sign-in isn&apos;t available yet.</p>}
    </>
  );
}

export default function AccountPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  return (
    <section className="mx-auto min-h-[50vh] max-w-md px-4 py-14 sm:px-6 md:py-20">
      <Suspense>
        <AccountContent searchParams={searchParams} />
      </Suspense>
    </section>
  );
}
