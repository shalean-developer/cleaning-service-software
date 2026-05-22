"use client";

import type { CleanerApplyFormState } from "./applyFormModel";
import { INITIAL_CLEANER_APPLY_FORM } from "./applyFormModel";

const STORAGE_KEY = "shalean-cleaner-apply-draft";
const DRAFT_VERSION = 2;

type StoredDraft = {
  version: number;
  step: number;
  values: CleanerApplyFormState;
  savedAt: string;
};

export function loadCleanerApplyDraft(): StoredDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredDraft;
    if (parsed.version !== DRAFT_VERSION) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveCleanerApplyDraft(step: number, values: CleanerApplyFormState): void {
  if (typeof window === "undefined") return;
  try {
    const payload: StoredDraft = {
      version: DRAFT_VERSION,
      step,
      values,
      savedAt: new Date().toISOString(),
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // quota / private mode. ignore
  }
}

export function clearCleanerApplyDraft(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

export function mergeDraftWithDefaults(values: CleanerApplyFormState): CleanerApplyFormState {
  return {
    ...INITIAL_CLEANER_APPLY_FORM,
    ...values,
    skills: { ...INITIAL_CLEANER_APPLY_FORM.skills, ...values.skills },
    references:
      values.references?.length > 0
        ? values.references
        : INITIAL_CLEANER_APPLY_FORM.references,
  };
}
