import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { GoogleButton } from "@/components/GoogleButton";
import { UserLoginForm } from "@/components/UserForms";
import { getCurrentBuyer } from "@/lib/auth/buyer-session";
import { isGoogleConfigured } from "@/lib/auth/google";
import { isDatabaseConfigured } from "@/lib/db";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to your NairobiEliteHomes account.",
  robots: { index: false, follow: false },
};

// Each one asks for the password, which is what a failed Google sign-in falls back to.
const ERRORS: Record<string, string> = {
  "google-failed": "Google sign-in didn't work. Please sign in with your email and password instead.",
  "not-configured": "Google sign-in isn't available right now. Please sign in with your email and password.",
};

async function LoginContent({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const [{ error }, buyer] = await Promise.all([searchParams, getCurrentBuyer()]);
  if (buyer) redirect("/account");
  if (!isDatabaseConfigured()) return <p className="text-bone-200">Sign-in isn&apos;t available yet.</p>;

  return (
    <>
      {error && ERRORS[error] && (
        <p role="alert" className="mb-6 rounded-lg border border-terracotta/50 p-3 text-sm text-terracotta">
          {ERRORS[error]}
        </p>
      )}
      {isGoogleConfigured() && (
        <div className="mb-6">
          <GoogleButton audience="buyer" />
          <p className="mt-6 text-center text-sm text-bone-200">or use your email and password</p>
        </div>
      )}
      <UserLoginForm />
      <p className="mt-6 text-sm text-bone-200">
        Passwords come from whoever set up your account. If you&apos;ve lost yours, ask them to reset it.
      </p>
    </>
  );
}

export default function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  return (
    <section className="mx-auto min-h-[50vh] max-w-md px-4 py-14 sm:px-6 md:py-20">
      <h1 className="mb-8 text-4xl text-bone-50">Sign in</h1>
      <Suspense>
        <LoginContent searchParams={searchParams} />
      </Suspense>
    </section>
  );
}
