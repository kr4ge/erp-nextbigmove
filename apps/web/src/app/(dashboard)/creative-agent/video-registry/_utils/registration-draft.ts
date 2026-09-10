"use client";

import type {
  CreativeKind,
  UnregisteredMetaCreative,
} from "../_types/video-registry";

const DRAFT_VERSION = 1;
const DRAFT_TTL_MS = 24 * 60 * 60 * 1000;
const DRAFT_KEY_PREFIX = "creative-registration-draft";

export type RegistrationDraftForm = {
  storeId: string;
  variationId: string;
  title: string;
  mediaUrl: string;
  format: string;
  hookType: string;
  angle: string;
  script: string;
  notes: string;
};

export type RegistrationDraftEntry = {
  kind: CreativeKind;
  form: RegistrationDraftForm;
};

export type RegistrationDraft = {
  version: typeof DRAFT_VERSION;
  savedAt: number;
  activeIndex: number;
  seed: UnregisteredMetaCreative | null;
  entries: RegistrationDraftEntry[];
};

const FORM_FIELDS: Array<keyof RegistrationDraftForm> = [
  "storeId",
  "variationId",
  "title",
  "mediaUrl",
  "format",
  "hookType",
  "angle",
  "script",
  "notes",
];

function storageKey(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const tenantId = window.localStorage.getItem("current_tenant_id")?.trim();
    const rawUser = window.localStorage.getItem("user");
    const parsedUser = rawUser ? JSON.parse(rawUser) as { id?: string; userId?: string } : null;
    const userId = (parsedUser?.id ?? parsedUser?.userId)?.trim();
    if (!tenantId || !userId) return null;
    return `${DRAFT_KEY_PREFIX}:${tenantId}:${userId}`;
  } catch {
    return null;
  }
}

function isDraftForm(value: unknown): value is RegistrationDraftForm {
  if (!value || typeof value !== "object") return false;
  return FORM_FIELDS.every((field) => typeof (value as Record<string, unknown>)[field] === "string");
}

function isDraftSeed(value: unknown): value is UnregisteredMetaCreative | null {
  if (value === null) return true;
  if (!value || typeof value !== "object") return false;
  const seed = value as Record<string, unknown>;
  return ["key", "adName", "accountId", "adId"].every((field) => typeof seed[field] === "string");
}

function isRegistrationDraft(value: unknown): value is RegistrationDraft {
  if (!value || typeof value !== "object") return false;
  const draft = value as Partial<RegistrationDraft>;
  return draft.version === DRAFT_VERSION
    && typeof draft.savedAt === "number"
    && typeof draft.activeIndex === "number"
    && isDraftSeed(draft.seed)
    && Array.isArray(draft.entries)
    && draft.entries.length > 0
    && draft.entries.every((entry) => (
      Boolean(entry)
      && (entry.kind === "VIDEO" || entry.kind === "STATIC")
      && isDraftForm(entry.form)
    ));
}

export function registrationDraftMatchesSeed(
  draftSeed: UnregisteredMetaCreative | null,
  currentSeed: UnregisteredMetaCreative | null,
): boolean {
  if (!draftSeed || !currentSeed) return draftSeed === currentSeed;
  return draftSeed.accountId === currentSeed.accountId && draftSeed.adId === currentSeed.adId;
}

export function hasMeaningfulRegistrationDraft(
  entries: RegistrationDraftEntry[],
  seed: UnregisteredMetaCreative | null,
): boolean {
  if (entries.length === 0) return false;
  if (seed || entries.length > 1) return true;
  return entries.some(({ form }) => (
    Boolean(form.variationId)
    || Boolean(form.title.trim())
    || Boolean(form.mediaUrl.trim())
    || Boolean(form.format)
    || Boolean(form.hookType)
    || Boolean(form.angle.trim())
    || Boolean(form.script.trim())
    || Boolean(form.notes.trim())
  ));
}

export function readRegistrationDraft(): RegistrationDraft | null {
  const key = storageKey();
  if (!key) return null;
  try {
    const raw = window.sessionStorage.getItem(key);
    if (!raw) return null;
    const draft = JSON.parse(raw) as unknown;
    if (!isRegistrationDraft(draft) || Date.now() - draft.savedAt > DRAFT_TTL_MS) {
      window.sessionStorage.removeItem(key);
      return null;
    }
    return draft;
  } catch {
    try { window.sessionStorage.removeItem(key); } catch { /* storage unavailable */ }
    return null;
  }
}

export function saveRegistrationDraft(
  entries: RegistrationDraftEntry[],
  seed: UnregisteredMetaCreative | null,
  activeIndex: number,
): void {
  const key = storageKey();
  if (!key) return;
  if (!hasMeaningfulRegistrationDraft(entries, seed)) {
    clearRegistrationDraft();
    return;
  }
  const draft: RegistrationDraft = {
    version: DRAFT_VERSION,
    savedAt: Date.now(),
    activeIndex: Math.max(0, Math.min(activeIndex, entries.length - 1)),
    seed,
    entries,
  };
  try {
    window.sessionStorage.setItem(key, JSON.stringify(draft));
  } catch {
    // Private browsing or a full storage quota must never block enrollment.
  }
}

export function clearRegistrationDraft(): void {
  const key = storageKey();
  if (!key) return;
  try { window.sessionStorage.removeItem(key); } catch { /* storage unavailable */ }
}
