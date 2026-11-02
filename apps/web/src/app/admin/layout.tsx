import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Admin",
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: ReactNode }) {
  return <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-12 sm:px-6">{children}</main>;
}
