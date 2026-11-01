// CMS values end up as iframe sources, so only these exact hosts are allowed.

const MATTERPORT_ID = /^[A-Za-z0-9]{6,20}$/;

/** A public Spline scene link, or null if it isn't one. */
export function splineEmbedUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  try {
    const url = new URL(raw);
    const isScene = url.protocol === "https:" && url.hostname === "my.spline.design";
    return isScene && url.pathname.length > 1 ? url.toString() : null;
  } catch {
    return null;
  }
}

/** The embed link for a Matterport model ID, or null if the ID is malformed. */
export function matterportEmbedUrl(id: string | null | undefined): string | null {
  if (!id || !MATTERPORT_ID.test(id)) return null;
  return `https://my.matterport.com/show/?m=${id}&play=1`;
}
