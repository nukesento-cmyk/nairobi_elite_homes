import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { GoogleButton } from "@/components/GoogleButton";
import { UserLoginForm } from "@/components/UserForms";
import { getCurrentBuyer } from "@/lib/auth/buyer-session";
import { isGoogleConfigured } from "@/lib/auth/google";
import { requireBrandSite } from "@/lib/brand-site-data";

type PageProps = { params: Promise<{ site: string }>; searchParams: Promise<{ error?: string }> };

export const metadata: Metadata = { title: { absolute: "Sign in" }, robots: { index: false, follow: false } };

const ERRORS: Record<string, string> = {
  "google-failed": "Google sign-in didn't work. Please sign in with your email and password instead.",
  "not-configured": "Google sign-in isn't available right now. Please sign in with your email and password.",
};

async function Login({ params, searchParams }: PageProps) {
  const site = await requireBrandSite(params);
  const [{ error }, buyer] = await Promise.all([searchParams, getCurrentBuyer()]);
  if (buyer) redirect(`${site.base}/account`);
  return (
    <>
      <h1 className="mb-8 text-4xl text-bone-50">Sign in to {site.name}</h1>
      {error && ERRORS[error] && (
        <p role="alert" className="mb-6 rounded-lg border border-terracotta/50 p-3 text-sm text-terracotta">{ERRORS[error]}</p>
      )}
      {isGoogleConfigured() && (
        <div className="mb-6">
          <GoogleButton audience="buyer" base={site.base} />
          <p className="mt-6 text-center text-sm text-bone-200">or use your email and password</p>
        </div>
      )}
      <UserLoginForm base={site.base} />
      <p className="mt-6 text-sm text-bone-200">
        Passwords come from whoever set up your account. If you&apos;ve lost yours, ask them to reset it.
      </p>
    </>
  );
}

export default function BrandLoginPage(props: PageProps) {
  return (
    <section className="mx-auto min-h-[50vh] max-w-md px-4 py-14 sm:px-6 md:py-20">
      <Suspense>
        <Login {...props} />
      </Suspense>
    </section>
  );
}
