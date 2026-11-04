import type { ReactNode } from "react";

/**
 * The dashboard's shared pieces, so every section looks and reads the same. Colours mean one
 * thing each: green is done, copper needs someone, terracotta is a problem, neutral is just a fact.
 */
export type Tone = "neutral" | "good" | "attention" | "problem";

const TONES: Record<Tone, string> = {
  neutral: "border-border text-bone-200",
  good: "border-moss/50 bg-moss/10 text-moss",
  attention: "border-copper/60 bg-copper/10 text-copper-400",
  problem: "border-terracotta/60 bg-terracotta/10 text-terracotta",
};

export function Badge({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap ${TONES[tone]}`}>
      {children}
    </span>
  );
}

export function PageHeader({ title, description, actions }: { title: string; description?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="mb-6 flex flex-wrap items-start justify-between gap-4 border-b border-border pb-5">
      <div className="min-w-0 max-w-2xl">
        <h2 className="text-3xl text-bone-50">{title}</h2>
        {description && <p className="mt-1.5 text-sm text-bone-200">{description}</p>}
      </div>
      {actions}
    </header>
  );
}

export function SectionTitle({ children, hint }: { children: ReactNode; hint?: ReactNode }) {
  return (
    <div className="mb-3">
      <h3 className="font-sans text-base font-semibold text-bone-50">{children}</h3>
      {hint && <p className="mt-1 text-sm text-bone-200">{hint}</p>}
    </div>
  );
}

export function Card({ children, className = "", ...data }: { children: ReactNode; className?: string } & Record<`data-${string}`, string>) {
  return <div {...data} className={`rounded-xl border border-border bg-forest-900/30 p-5 ${className}`}>{children}</div>;
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-border px-6 py-10 text-center">
      <p className="text-bone-50">{title}</p>
      {children && <p className="mx-auto mt-1 max-w-md text-sm text-bone-200">{children}</p>}
    </div>
  );
}

export function Callout({ tone = "attention", children }: { tone?: Tone; children: ReactNode }) {
  return <div role="note" className={`rounded-lg border px-4 py-3 text-sm ${TONES[tone]}`}>{children}</div>;
}

export function Stat({ label, value, note, tone = "neutral" }: { label: string; value: ReactNode; note?: string; tone?: Tone }) {
  return (
    <div className="rounded-xl border border-border bg-forest-900/30 p-4">
      <p className="text-sm text-bone-200">{label}</p>
      <p className={`mt-1 font-heading text-3xl ${tone === "neutral" ? "text-bone-50" : TONES[tone].split(" ").at(-1)}`}>{value}</p>
      {note && <p className="mt-1 text-xs text-bone-200">{note}</p>}
    </div>
  );
}

export type AttentionItem = { href: string; label: string; count: number; tone?: Tone };

/** What needs someone today, each a link to where it gets done. Nothing to do reads as good news. */
export function AttentionList({ items }: { items: AttentionItem[] }) {
  const open = items.filter((item) => item.count > 0);
  if (open.length === 0) {
    return <Callout tone="good">All clear. Nothing is waiting for you right now.</Callout>;
  }
  return (
    <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {open.map((item) => (
        <li key={item.href}>
          <a href={item.href} className="group flex items-center justify-between gap-4 rounded-xl border border-border bg-forest-900/30 p-4 transition-colors hover:border-copper focus-visible:outline-2 focus-visible:outline-copper-400">
            <span className="text-sm text-bone-100">{item.label}</span>
            <span className={`font-heading text-2xl ${item.tone === "problem" ? "text-terracotta" : "text-copper-400"}`}>{item.count}</span>
          </a>
        </li>
      ))}
    </ul>
  );
}
