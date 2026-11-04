import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { UserChangePasswordForm } from "@/components/UserForms";
import { buttonVariants } from "@/components/ui/button";
import { getCurrentBuyer } from "@/lib/auth/buyer-session";

import { buyerSignOut } from "./actions";

export const metadata: Metadata = {
  title: "Your account",
  description: "Your NairobiEliteHomes account.",
  robots: { index: false, follow: false },
};

async function AccountContent() {
  const buyer = await getCurrentBuyer();
  if (!buyer) redirect("/login");

  const signOut = (
    <form action={buyerSignOut} className="mt-6">
      <button type="submit" className="text-sm text-bone-200 underline underline-offset-4">
        Sign out
      </button>
    </form>
  );

  // A temporary password came from a member of staff, so it's replaced before anything else.
  if (buyer.mustChangePassword) {
    return (
      <>
        <h1 className="text-4xl text-bone-50">Choose your own password</h1>
        <p className="mt-2 mb-8 text-bone-200">You&apos;re using a temporary password. Replace it to continue.</p>
        <UserChangePasswordForm />
        {signOut}
      </>
    );
  }

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
        {buyer.hasPassword && (
          <details className="mt-6 rounded-xl border border-border p-6">
            <summary className="cursor-pointer text-copper-400">Change your password</summary>
            <div className="mt-5"><UserChangePasswordForm /></div>
          </details>
        )}
        {signOut}
      </>
  );
}

export default function AccountPage() {
  return (
    <section className="mx-auto min-h-[50vh] max-w-md px-4 py-14 sm:px-6 md:py-20">
      <Suspense>
        <AccountContent />
      </Suspense>
    </section>
  );
}
