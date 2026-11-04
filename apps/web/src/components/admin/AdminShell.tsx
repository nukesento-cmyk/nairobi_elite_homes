"use client";

import { useEffect, useSyncExternalStore, type ReactNode } from "react";

export type ShellItem = { id: string; label: string; count?: number; urgent?: boolean; content: ReactNode };
export type ShellGroup = { label: string | null; items: ShellItem[] };

const subscribe = (change: () => void) => {
  window.addEventListener("hashchange", change);
  return () => window.removeEventListener("hashchange", change);
};
const currentHash = () => window.location.hash.slice(1);

function Count({ item, active }: { item: ShellItem; active: boolean }) {
  if (!item.count) return null;
  return (
    <span className={`ml-auto rounded-full px-2 py-0.5 text-xs font-medium ${
      item.urgent ? "bg-copper text-forest-950" : active ? "bg-forest-950/40 text-bone-50" : "text-bone-200"
    }`}>
      {item.count}
    </span>
  );
}

/**
 * One section at a time, chosen by the address, so a section can be linked to and the back button
 * works. Every section stays mounted, so a half-filled form survives switching away and back.
 */
export function AdminShell({ groups, title, person, footer }: { groups: ShellGroup[]; title: string; person: ReactNode; footer: ReactNode }) {
  const hash = useSyncExternalStore(subscribe, currentHash, () => "");
  const items = groups.flatMap((group) => group.items);
  const active = items.some((item) => item.id === hash) ? hash : items[0]?.id;

  // Each section reads from its top, rather than wherever the last one was scrolled to.
  useEffect(() => {
    if (hash) window.scrollTo({ top: 0 });
  }, [hash]);

  const link = (item: ShellItem, compact: boolean) => {
    const isActive = item.id === active;
    return (
      <a
        key={item.id}
        href={`#${item.id}`}
        aria-current={isActive ? "page" : undefined}
        className={`flex items-center gap-2 rounded-lg text-sm transition-colors focus-visible:outline-2 focus-visible:outline-copper-400 ${
          compact ? "shrink-0 border px-3 py-1.5" : "px-3 py-2"
        } ${
          isActive
            ? `bg-forest-800 font-medium text-bone-50 ${compact ? "border-copper" : ""}`
            : `text-bone-200 hover:bg-forest-900/60 hover:text-bone-50 ${compact ? "border-border" : ""}`
        }`}
      >
        {item.label}
        <Count item={item} active={isActive} />
      </a>
    );
  };

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[16rem_minmax(0,1fr)]">
      <aside className="hidden border-r border-border lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col">
        <div className="border-b border-border px-5 py-5">
          <p className="font-heading text-xl text-bone-50">{title}</p>
          <div className="mt-1">{person}</div>
        </div>
        <nav aria-label="Dashboard sections" className="flex-1 space-y-5 overflow-y-auto p-3">
          {groups.map((group, index) => (
            <div key={group.label ?? index}>
              {group.label && <p className="mb-1 px-3 text-xs font-medium tracking-wide text-bone-200/70 uppercase">{group.label}</p>}
              <div className="space-y-0.5">{group.items.map((item) => link(item, false))}</div>
            </div>
          ))}
        </nav>
        <div className="border-t border-border p-4">{footer}</div>
      </aside>

      <div className="min-w-0">
        <div className="sticky top-0 z-20 border-b border-border bg-background lg:hidden">
          <div className="flex items-center justify-between gap-3 px-4 pt-3">
            <div className="min-w-0">
              <p className="font-heading text-lg text-bone-50">{title}</p>
              {person}
            </div>
            {footer}
          </div>
          <nav aria-label="Dashboard sections, small screen" className="flex gap-2 overflow-x-auto px-4 py-3">
            {items.map((item) => link(item, true))}
          </nav>
        </div>
        <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-8 lg:py-10">
          {items.map((item) => (
            <div key={item.id} id={item.id} hidden={item.id !== active}>{item.content}</div>
          ))}
        </main>
      </div>
    </div>
  );
}
