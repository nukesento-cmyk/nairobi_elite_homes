import { redirect } from "next/navigation";
import { Suspense } from "react";

import { LoginForm } from "@/components/admin/AdminForms";
import { GoogleButton } from "@/components/GoogleButton";
import { getCurrentAdmin, isAdminConfigured } from "@/lib/admin/session";
import { isGoogleConfigured } from "@/lib/auth/google";

const ERRORS: Record<string, string> = {
  "google-failed": "Google sign-in didn't complete. Please try again.",
  "no-staff-account": "There's no staff account for that Google email. Ask whoever manages accounts to add you.",
  "not-configured": "Google sign-in isn't available yet.",
};

type LoginProps = { searchParams: Promise<{ error?: string }> };

async function LoginContent({ searchParams }: LoginProps) {
  if (await getCurrentAdmin()) redirect("/admin");
  if (!isAdminConfigured()) {
    return <p className="text-bone-200">Admin accounts aren&apos;t set up yet. See docs/admin-accounts.md.</p>;
  }
  const { error } = await searchParams;
  return (
    <>
      {error && ERRORS[error] && (
        <p role="alert" className="mb-4 text-sm text-terracotta">{ERRORS[error]}</p>
      )}
      {isGoogleConfigured() && (
        <div className="mb-6">
          <GoogleButton audience="staff" />
          <p className="mt-6 text-center text-sm text-bone-200">or use your password</p>
        </div>
      )}
      <LoginForm />
    </>
  );
}

export default function AdminLoginPage({ searchParams }: LoginProps) {
  return (
    <div className="mx-auto max-w-sm">
      <h1 className="mb-8 text-4xl text-bone-50">Staff sign in</h1>
      <Suspense>
        <LoginContent searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
