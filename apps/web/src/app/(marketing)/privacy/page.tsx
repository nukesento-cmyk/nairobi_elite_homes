import type { Metadata } from "next";

import { PrivacyPolicy } from "@/components/PrivacyPolicy";
import { site } from "@/config/site";

export const metadata: Metadata = {
  title: "Privacy policy",
  description: `How ${site.name} handles your personal information.`,
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPage() {
  return <PrivacyPolicy name={site.name} email={site.contact.email} phone={site.contact.phone} />;
}
