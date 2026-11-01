import { ViewTransition, type ReactNode } from "react";

// A template remounts on navigation where a layout doesn't, so enter and exit fire.
// The animations are in globals.css. First page loads don't animate, so they can't
// delay the largest paint.
export default function MarketingTemplate({ children }: { children: ReactNode }) {
  return (
    <ViewTransition enter="page-enter" exit="page-exit" default="none">
      <div>{children}</div>
    </ViewTransition>
  );
}
