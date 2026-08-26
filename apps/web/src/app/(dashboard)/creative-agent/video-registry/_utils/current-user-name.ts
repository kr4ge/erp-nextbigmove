"use client";

/**
 * The signed-in user's display name, read from the cached session.
 *
 * The enrollment payload never carries a creator — the API assigns it from the
 * caller — so the dialog has no other source for the name it needs to preview
 * the ad name. This mirrors how the dashboard layout and the other controllers
 * read the cached user rather than adding a round trip for one string.
 *
 * Returns null when unavailable (server render, cleared storage, malformed
 * cache); callers must fall back to a name without the creator segment.
 */
export function readCurrentUserName(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem("user");
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { firstName?: string; lastName?: string };
    const name = [parsed.firstName, parsed.lastName]
      .map((part) => part?.trim())
      .filter(Boolean)
      .join(" ");
    return name || null;
  } catch {
    return null;
  }
}
