"use client";

import { useActionState, useEffect, useRef, useTransition, type FormEvent } from "react";

import type { ActionState } from "@/app/admin/actions";

type Action = (state: ActionState, form: FormData) => Promise<ActionState>;

/**
 * React clears a form after its action runs, even when the action refused it, which would throw
 * away a caller's notes over one missed tick. This keeps what was typed until a save succeeds.
 */
export function useSafeForm(action: Action) {
  const [state, run, pending] = useActionState(action, {});
  const [, startTransition] = useTransition();
  const ref = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.message && !state.error) ref.current?.reset();
  }, [state]);

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    // Includes the button pressed, for forms where it carries a value.
    const data = new FormData(event.currentTarget, (event.nativeEvent as SubmitEvent).submitter);
    startTransition(() => run(data));
  };

  return { state, pending, form: { ref, onSubmit } };
}
