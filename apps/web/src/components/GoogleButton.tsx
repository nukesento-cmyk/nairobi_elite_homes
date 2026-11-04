// A plain link, because signing in leaves the site. It must not be prefetched.
export function GoogleButton({ audience, base = "" }: { audience: "buyer" | "staff"; base?: string }) {
  return (
    <a
      href={`/api/auth/google?for=${audience}${base ? `&base=${encodeURIComponent(base)}` : ""}`}
      className="inline-flex h-12 w-full items-center justify-center rounded-lg border border-border bg-bone-50 px-5 text-sm font-medium text-forest-950 transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-copper-400"
    >
      Continue with Google
    </a>
  );
}
