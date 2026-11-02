import { redirect } from "next/navigation";
import { Suspense } from "react";

import { LoginForm } from "@/components/admin/AdminForms";
import { getCurrentAdmin, isAdminConfigured } from "@/lib/admin/session";

async function LoginContent() {
  if (await getCurrentAdmin()) redirect("/admin");
  if (!isAdminConfigured()) {
    return <p className="text-bone-200">Admin accounts aren&apos;t set up yet. See docs/admin-accounts.md.</p>;
  }
  return <LoginForm />;
}

export default function AdminLoginPage() {
  return (
    <div className="mx-auto max-w-sm">
      <h1 className="mb-8 text-4xl text-bone-50">Admin sign in</h1>
      <Suspense>
        <LoginContent />
      </Suspense>
    </div>
  );
}
