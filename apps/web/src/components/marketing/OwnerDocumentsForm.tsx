"use client";

import { useState, useSyncExternalStore, type FormEvent } from "react";

import { buttonVariants } from "@/components/ui/button";
import { MAX_DOCUMENT_BYTES, OWNER_DOCUMENT_TYPES } from "@/lib/acquisition/onboarding-types";

const fieldClass =
  "mt-1.5 h-11 w-full rounded-lg border border-input bg-background px-3 text-sm text-bone-50 focus-visible:outline-2 focus-visible:outline-copper-400";

const noChange = () => () => {};
const tokenInAddress = () => window.location.hash.slice(1);

export function OwnerDocumentsForm() {
  // Empty until the browser has read the address, because the secret is never sent to the server.
  const token = useSyncExternalStore(noChange, tokenInAddress, () => "");
  const [sent, setSent] = useState<string[]>([]);
  const [error, setError] = useState<string>();
  const [sending, setSending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const file = data.get("file");
    setError(undefined);

    if (!data.get("docType")) return setError("Choose what kind of document this is.");
    if (!(file instanceof File) || file.size === 0) return setError("Choose a file.");
    if (file.size > MAX_DOCUMENT_BYTES) return setError("Files can be up to 4 MB. Please send a smaller one.");

    data.set("token", token);
    setSending(true);
    try {
      const response = await fetch("/api/onboarding-upload", { method: "POST", body: data });
      if (!response.ok) {
        const result = (await response.json()) as { error?: string };
        setError(result.error ?? "Something went wrong. Please try again.");
        return;
      }
      const label = OWNER_DOCUMENT_TYPES.find((type) => type.value === data.get("docType"))?.label ?? "Document";
      setSent((current) => [...current, label]);
      form.reset();
    } catch {
      setError("We couldn't reach the server. Please check your connection and try again.");
    } finally {
      setSending(false);
    }
  }

  if (!token) {
    return <p className="text-bone-100">Please open the full link we sent you. If it doesn&apos;t work, ask us for a new one.</p>;
  }

  return (
    <form onSubmit={submit} className="space-y-4 text-sm text-bone-200">
      <label className="block">
        What is this?
        <select name="docType" defaultValue="" className={fieldClass}>
          <option value="" disabled>Choose one</option>
          {OWNER_DOCUMENT_TYPES.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
        </select>
      </label>
      <label className="block">
        File (PDF, JPG, PNG or WebP, up to 4 MB)
        <input name="file" type="file" accept="application/pdf,image/jpeg,image/png,image/webp" className="mt-1.5 block w-full text-bone-100" />
      </label>
      <button type="submit" disabled={sending} className={buttonVariants({ size: "cta", className: "w-full sm:w-auto" })}>
        {sending ? "Sending" : "Send securely"}
      </button>
      {error && <p role="alert" className="text-copper-400">{error}</p>}
      {sent.length > 0 && (
        <div role="status" className="text-bone-50">
          <p>Received, thank you. You can send another:</p>
          <ul className="mt-1 list-disc pl-5">
            {sent.map((label, index) => <li key={`${label}-${index}`}>{label}</li>)}
          </ul>
        </div>
      )}
    </form>
  );
}
