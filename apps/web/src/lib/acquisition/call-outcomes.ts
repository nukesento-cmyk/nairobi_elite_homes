/** Kept apart from the server code, so the call form can use the same list. */
export const CALL_OUTCOMES = [
  { value: "no_answer", label: "No answer" },
  { value: "answered", label: "Spoke to them, no decision yet" },
  { value: "interested", label: "Interested" },
  { value: "meeting_booked", label: "Meeting booked" },
  { value: "not_interested", label: "Not interested" },
  { value: "wrong_person", label: "Wrong person" },
  { value: "opt_out", label: "Asked not to be contacted" },
] as const;
