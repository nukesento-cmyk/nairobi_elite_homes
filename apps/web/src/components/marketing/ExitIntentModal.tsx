"use client";

import { X } from "lucide-react";
import { useEffect, useRef } from "react";

import { buttonVariants } from "@/components/ui/button";
import { site } from "@/config/site";
import { getCommunityCopy } from "@/content/community";
import { track } from "@/lib/analytics";

import { JoinLink } from "./JoinLink";

const STORAGE_KEY = "neh-exit-modal-shown";
const { cta } = getCommunityCopy(site);

function alreadyShown(): boolean {
  try {
    return sessionStorage.getItem(STORAGE_KEY) !== null;
  } catch {
    return true; // Without storage we can't honour "once per session", so don't show it.
  }
}

type ExitIntentModalProps = { title: string; body: string };

export function ExitIntentModal({ title, body }: ExitIntentModalProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const clicked = useRef(false);

  useEffect(() => {
    // Desktop only: phones have no pointer that can head for the tab bar.
    const hasMouse = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    if (!hasMouse || alreadyShown()) return;

    function onMouseOut(event: MouseEvent) {
      if (event.relatedTarget !== null || event.clientY > 0) return;
      document.removeEventListener("mouseout", onMouseOut);
      if (alreadyShown()) return;
      sessionStorage.setItem(STORAGE_KEY, "true");
      dialog.current?.showModal();
      track("exit_modal_shown", {});
    }

    document.addEventListener("mouseout", onMouseOut);
    return () => document.removeEventListener("mouseout", onMouseOut);
  }, []);

  return (
    <dialog
      ref={dialog}
      aria-labelledby="exit-modal-title"
      onClose={() => {
        if (!clicked.current) track("exit_modal_dismissed", {});
      }}
      className="m-auto w-[min(92vw,32rem)] rounded-xl border border-copper/40 bg-forest-900 p-8 text-bone-50 backdrop:bg-forest-950/80"
    >
      <form method="dialog" className="absolute top-3 right-3">
        <button
          aria-label="Close"
          className="flex size-10 items-center justify-center rounded-md text-bone-200 hover:text-bone-50 focus-visible:outline-2 focus-visible:outline-copper-400"
        >
          <X aria-hidden="true" className="size-5" />
        </button>
      </form>
      <h2 id="exit-modal-title" className="pr-8 font-heading text-3xl">
        {title}
      </h2>
      <p className="mt-3 mb-6 text-bone-200">{body}</p>
      <JoinLink
        source="exit_modal"
        placement="exit_modal"
        onClick={() => {
          clicked.current = true;
          track("exit_modal_clicked", {});
          dialog.current?.close();
        }}
        className={buttonVariants({ size: "cta", className: "w-full" })}
      >
        {cta.long}
      </JoinLink>
    </dialog>
  );
}
