const STORAGE_KEY = "neh-urgency-strip-dismissed";

/**
 * Runs before first paint, so a strip dismissed earlier this session never
 * flashes and then collapses (which would count against CLS). The matching CSS
 * rule is in globals.css.
 */
export const restoreDismissalScript = `try{if(sessionStorage.getItem("${STORAGE_KEY}")){document.documentElement.dataset.stripDismissed="true"}}catch(e){}`;

export function dismissStrip(): void {
  document.documentElement.dataset.stripDismissed = "true";
  try {
    sessionStorage.setItem(STORAGE_KEY, "true");
  } catch {
    // Storage can be blocked. The strip stays hidden until the next full page load.
  }
}
