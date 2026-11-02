import type { Metadata } from "next";

import { LeadForm } from "@/components/marketing/LeadForm";
import { buttonVariants } from "@/components/ui/button";
import { site } from "@/config/site";
import { directChatLink } from "@/lib/whatsapp";

export const metadata: Metadata = {
  title: "Contact",
  description: "Talk to NairobiEliteHomes about buying, renting, selling or land in Nairobi.",
  alternates: { canonical: "/contact" },
};

export default function ContactPage() {
  const { email, phone } = site.contact;

  return (
    <section className="mx-auto grid max-w-7xl gap-12 px-4 py-14 sm:px-6 md:py-20 lg:grid-cols-2">
      <div>
        <h1 className="text-5xl text-bone-50 md:text-7xl">Contact</h1>
        <p className="mt-4 mb-8 max-w-xl text-lg text-bone-200">
          Tell us what you&apos;re looking for, or message us directly on WhatsApp.
        </p>
        <a
          href={directChatLink("Hello, I have a question about property in Nairobi.")}
          target="_blank"
          rel="noopener noreferrer"
          className={buttonVariants({ size: "cta", className: "w-full sm:w-auto" })}
        >
          Message us on WhatsApp
        </a>
        <ul className="mt-8 space-y-2 text-bone-50">
          {email && (
            <li>
              <a href={`mailto:${email}`} className="hover:text-copper-400">
                {email}
              </a>
            </li>
          )}
          {phone && (
            <li>
              <a href={`tel:${phone}`} className="hover:text-copper-400">
                {phone}
              </a>
            </li>
          )}
        </ul>
      </div>
      <div className="rounded-xl border border-border p-6">
        <h2 className="text-2xl text-bone-50">Send us a message</h2>
        <LeadForm source="contact_page" />
      </div>
    </section>
  );
}
