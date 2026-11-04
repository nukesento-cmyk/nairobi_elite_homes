const SECTIONS: { heading: string; items: string[] }[] = [
  {
    heading: "What we collect",
    items: [
      "When you sign in with Google: your name, email address and Google account ID. We don't see your Google password, and we don't ask for access to anything else in your Google account.",
      "When an account is created for you: your name and email address, and a scrambled (hashed) version of your password.",
      "When you ask to join the private community: your name, WhatsApp number, and any email address and message you give us.",
      "When you send an enquiry: the contact details and message you enter in the form.",
    ],
  },
  {
    heading: "How we use it",
    items: [
      "To sign you in and keep you signed in.",
      "To reply to your enquiry or your request to join, including by WhatsApp or email.",
      "We don't sell your information, and we don't use your Google account information for advertising.",
    ],
  },
  {
    heading: "Who else handles it",
    items: [
      "Service providers that run this website for us store or carry this information on our behalf: website hosting, the database, and email delivery. Google handles Google sign-in, and WhatsApp carries any chat you have with us.",
    ],
  },
  {
    heading: "How long we keep it",
    items: [
      "Your account stays until you ask us to delete it, or staff remove it. Requests to join are deleted once they're no longer needed. Sign-in sessions end after 30 days at most.",
    ],
  },
  {
    heading: "Your choices",
    items: [
      "You can ask us for a copy of your information, ask us to correct it, or ask us to delete it, using the contact details below.",
      "You can also remove this site's access at any time from your Google account's security settings.",
    ],
  },
];

type PrivacyPolicyProps = { name: string; email: string | null; phone: string | null };

export function PrivacyPolicy({ name, email, phone }: PrivacyPolicyProps) {
  return (
    <section className="mx-auto max-w-2xl px-4 py-14 sm:px-6 md:py-20">
      <h1 className="text-4xl text-bone-50">Privacy policy</h1>
      <p className="mt-3 text-bone-200">How {name} handles your personal information.</p>
      {SECTIONS.map(({ heading, items }) => (
        <div key={heading} className="mt-10">
          <h2 className="text-2xl text-bone-50">{heading}</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-bone-100">
            {items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      ))}
      {(email || phone) && (
        <div className="mt-10">
          <h2 className="text-2xl text-bone-50">Contact us</h2>
          <p className="mt-3 text-bone-100">
            {email && (
              <a href={`mailto:${email}`} className="text-copper-400 underline underline-offset-4">
                {email}
              </a>
            )}
            {email && phone && " · "}
            {phone}
          </p>
        </div>
      )}
    </section>
  );
}
