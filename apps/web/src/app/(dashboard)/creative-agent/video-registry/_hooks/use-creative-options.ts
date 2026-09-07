"use client";

import { useCallback, useEffect, useState } from "react";
import { createCreativeOption, fetchCreativeOptions } from "../_services/video-registry.service";
import type { CreativeOptionField, CreativeOptions } from "../_types/video-registry";

const FIELD_KEY: Record<CreativeOptionField, keyof CreativeOptions> = {
  HOOK_TYPE: "hookTypes",
  VIDEO_FORMAT: "videoFormats",
  STATIC_FORMAT: "staticFormats",
};

/**
 * The tenant's option lists for the enroll/edit dialogs, plus an adder that
 * persists a new value server-side and folds it into the list immediately —
 * the next dialog anyone in the tenant opens will fetch it too.
 */
export function useCreativeOptions(enabled: boolean) {
  const [options, setOptions] = useState<CreativeOptions | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    fetchCreativeOptions()
      .then((next) => { if (!cancelled) setOptions(next); })
      .catch(() => { /* fall back to the built-in constants in the fields */ });
    return () => { cancelled = true; };
  }, [enabled]);

  const addOption = useCallback(async (field: CreativeOptionField, label: string): Promise<string> => {
    const created = await createCreativeOption(field, label);
    setOptions((current) => {
      if (!current) return current;
      const key = FIELD_KEY[field];
      if (current[key].some((option) => option.value === created.value)) return current;
      return { ...current, [key]: [...current[key], created] };
    });
    return created.value;
  }, []);

  return { options, addOption };
}
