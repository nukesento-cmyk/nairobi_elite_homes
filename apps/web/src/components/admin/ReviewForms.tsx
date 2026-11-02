"use client";

import { useActionState } from "react";

import type { ActionState } from "@/app/admin/actions";
import {
  approveAction,
  deleteRequestAction,
  rejectAction,
  requestStatusAction,
} from "@/app/admin/content-actions";
import { buttonVariants } from "@/components/ui/button";

const button = buttonVariants({ variant: "outline", size: "default", className: "h-10 bg-transparent px-4" });
const fieldClass =
  "mt-1.5 w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm text-bone-50 focus-visible:outline-2 focus-visible:outline-copper-400";

function Result({ state }: { state: ActionState }) {
  return (
    <>
      {state.error && <p role="alert" className="mt-2 text-sm text-terracotta">{state.error}</p>}
      {state.message && <p role="status" className="mt-2 text-sm text-bone-50">{state.message}</p>}
    </>
  );
}

export function ReviewItem({
  kind,
  id,
  title,
  meta,
  body,
  photo,
}: {
  kind: "property" | "post";
  id: string;
  title: string;
  meta: string[];
  body: string | null;
  photo: string | null;
}) {
  const [approveState, approve, approving] = useActionState(approveAction, {});
  const [rejectState, reject, rejecting] = useActionState(rejectAction, {});
  return (
    <li data-review={title} className="rounded-xl border border-copper/40 p-5">
      <p className="text-lg text-bone-50">{title}</p>
      {meta.map((line) => <p key={line} className="text-sm text-bone-200">{line}</p>)}
      {photo && (
        <a href={photo} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-sm text-copper-400 underline underline-offset-4">
          View photo
        </a>
      )}
      {body && <p className="mt-3 text-sm whitespace-pre-line text-bone-100">{body}</p>}
      <div className="mt-4 flex flex-wrap items-start gap-4">
        <form action={approve}>
          <input type="hidden" name="kind" value={kind} />
          <input type="hidden" name="id" value={id} />
          <button type="submit" disabled={approving} className={buttonVariants({ size: "default", className: "h-10 px-4" })}>
            Approve
          </button>
          <Result state={approveState} />
        </form>
        <form action={reject} className="min-w-60 flex-1">
          <input type="hidden" name="kind" value={kind} />
          <input type="hidden" name="id" value={id} />
          <label className="block text-sm text-bone-200">
            What needs changing?
            <input name="note" required minLength={3} maxLength={500} className={fieldClass} />
          </label>
          <button type="submit" disabled={rejecting} className={`${button} mt-2`}>
            Send back
          </button>
          <Result state={rejectState} />
        </form>
      </div>
    </li>
  );
}

const STATUS_LABEL = { pending: "Waiting", link_sent: "Link sent", declined: "Declined" };

type RequestRowProps = {
  request: {
    id: string;
    name: string;
    phone: string;
    email: string | null;
    message: string | null;
    status: keyof typeof STATUS_LABEL;
    createdAt: string;
  };
  chatUrl: string;
};

function StatusButton({ id, status, label }: { id: string; status: string; label: string }) {
  const [state, action, pending] = useActionState(requestStatusAction, {});
  return (
    <form action={action}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="status" value={status} />
      <button type="submit" disabled={pending} className={button}>{label}</button>
      <Result state={state} />
    </form>
  );
}

export function RequestRow({ request, chatUrl }: RequestRowProps) {
  const [state, remove, removing] = useActionState(deleteRequestAction, {});
  return (
    <li data-request={request.phone} className="rounded-xl border border-border p-5">
      <p className="text-lg text-bone-50">{request.name}</p>
      <p className="text-sm text-bone-200">
        {request.phone}
        {request.email && ` · ${request.email}`} · {request.createdAt}
      </p>
      {request.message && <p className="mt-2 text-sm whitespace-pre-line text-bone-100">{request.message}</p>}
      <p className="mt-2 text-sm text-copper-400">{STATUS_LABEL[request.status]}</p>
      <div className="mt-3 flex flex-wrap items-start gap-3">
        <a href={chatUrl} target="_blank" rel="noopener noreferrer" className={button}>Open WhatsApp</a>
        {request.status !== "link_sent" && <StatusButton id={request.id} status="link_sent" label="Mark link sent" />}
        {request.status !== "declined" && <StatusButton id={request.id} status="declined" label="Decline" />}
        <form action={remove}>
          <input type="hidden" name="id" value={request.id} />
          <button type="submit" disabled={removing} className={button}>Delete</button>
          <Result state={state} />
        </form>
      </div>
    </li>
  );
}
