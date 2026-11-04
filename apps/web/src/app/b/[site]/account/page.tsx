import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { buyerSignOut } from "@/app/(marketing)/account/actions";
import { UserChangePasswordForm } from "@/components/UserForms";
import { getCurrentBuyer } from "@/lib/auth/buyer-session";
import { requireBrandSite } from "@/lib/brand-site-data";

type PageProps = { params: Promise<{ site: string }> };

export const metadata: Metadata = { title: { absolute: "Your account" }, robots: { index: false, follow: false } };

async function Account({ params }: PageProps) {
  const site = await requireBrandSite(params);
  const buyer = await getCurrentBuyer();
  if (!buyer) redirect(`${site.base}/login`);

  const signOut = (
    <form action={buyerSignOut} className="mt-6">
      <input type="hidden" name="base" value={site.base} />
      <button type="submit" className="text-sm text-bone-200 underline underline-offset-4">Sign out</button>
    </form>
  );

  if (buyer.mustChangePassword) {
    return (
      <>
        <h1 className="text-4xl text-bone-50">Choose your own password</h1>
        <p className="mt-2 mb-8 text-bone-200">You&apos;re using a temporary password. Replace it to continue.</p>
        <UserChangePasswordForm base={site.base} />
        {signOut}
      </>
    );
  }

  return (
    <>
      <h1 className="text-4xl text-bone-50">Welcome, {buyer.name}</h1>
      <p className="mt-2 text-bone-200">Signed in as {buyer.email}</p>
      <div className="mt-8 rounded-xl border border-border p-6">
        <h2 className="text-2xl text-bone-50">Your account</h2>
        <p className="mt-2 text-bone-200">Browse {site.name}&apos;s listings, or ask for access to its off-market ones.</p>
        <div className="mt-5 flex flex-wrap gap-5 text-copper-400">
          <Link href={`${site.base}/homes`} className="underline underline-offset-4">Homes</Link>
          <Link href={`${site.base}/land`} className="underline underline-offset-4">Land</Link>
          <Link href={`${site.base}/join`} className="underline underline-offset-4">Ask for access</Link>
        </div>
      </div>
      {buyer.hasPassword && (
        <details className="mt-6 rounded-xl border border-border p-6">
          <summary className="cursor-pointer text-copper-400">Change your password</summary>
          <div className="mt-5"><UserChangePasswordForm base={site.base} /></div>
        </details>
      )}
      {signOut}
    </>
  );
}

export default function BrandAccountPage(props: PageProps) {
  return (
    <section className="mx-auto min-h-[50vh] max-w-md px-4 py-14 sm:px-6 md:py-20">
      <Suspense>
        <Account {...props} />
      </Suspense>
    </section>
  );
}
