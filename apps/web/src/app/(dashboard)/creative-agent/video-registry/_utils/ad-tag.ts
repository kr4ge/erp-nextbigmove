/**
 * The Ad Tag: what gets pasted into Meta as the ad name.
 *
 *   Library title - Editor name - TB-V0004
 *
 * The registry matches on the code at the end, which it finds anywhere inside
 * an ad name — so the title and editor in front are free context for whoever is
 * reading the ads manager, and cost nothing at match time.
 */
export const AD_TAG_SEPARATOR = " - ";

export function buildAdTag(parts: { title: string; editor: string; code: string }): string {
  return [parts.title.trim(), parts.editor.trim(), parts.code.trim()]
    .filter(Boolean)
    .join(AD_TAG_SEPARATOR);
}

/** The signed-in person's display name, for the editor slot. Falls back to the
 *  email, then to an empty string so the tag degrades to title + code rather
 *  than carrying the word "unknown" into a live ad name. */
export function readEditorName(): string {
  if (typeof window === "undefined") return "";
  try {
    const raw = window.localStorage.getItem("user");
    if (!raw) return "";
    const user = JSON.parse(raw) as { firstName?: string; lastName?: string; email?: string };
    const name = [user.firstName, user.lastName].filter(Boolean).join(" ").trim();
    return name || user.email || "";
  } catch {
    return "";
  }
}
