"use client";

import { Menu, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import type { NavItem } from "@/config/nav";

export function MobileMenu({ items }: { items: NavItem[] }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="md:hidden">
      <button
        type="button"
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        aria-controls="mobile-menu"
        onClick={() => setOpen(!open)}
        className="flex size-11 items-center justify-center rounded-md text-bone-50 focus-visible:outline-2 focus-visible:outline-copper-400"
      >
        {open ? <X aria-hidden="true" className="size-6" /> : <Menu aria-hidden="true" className="size-6" />}
      </button>
      {open && (
        <nav
          id="mobile-menu"
          aria-label="Mobile"
          className="absolute inset-x-0 top-full z-40 border-b border-border bg-forest-950 px-4 py-2"
        >
          <ul>
            {items.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className="block py-3 text-lg text-bone-50"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </div>
  );
}
