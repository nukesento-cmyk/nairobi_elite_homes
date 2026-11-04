import type { Metadata } from "next";

import { OwnerForm } from "@/components/marketing/OwnerForm";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "List your property",
  description: "Own or manage property in Nairobi? Tell NairobiEliteHomes about it, and we'll talk through marketing it.",
  path: "/list-your-property",
});

export default function ListYourPropertyPage() {
  return (
    <section className="mx-auto max-w-2xl px-4 py-14 sm:px-6 md:py-20">
      <h1 className="text-5xl text-bone-50 md:text-7xl">List your property</h1>
      <p className="mt-4 mb-8 text-lg text-bone-200">
        Tell us about a home, building, plot or commercial space in Nairobi. Someone from our team will contact you. Before anything is published, we&apos;ll ask for documents confirming ownership or your authority to market it, and your written approval.
      </p>
      <OwnerForm />
    </section>
  );
}
