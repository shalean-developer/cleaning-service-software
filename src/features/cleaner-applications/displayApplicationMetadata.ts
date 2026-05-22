import {
  CLEANER_APPLY_SKILL_LABELS,
  CLEANER_APPLY_WORK_PREFERENCE_LABELS,
  type CleanerApplySkillKey,
  type CleanerApplyWorkPreference,
} from "./applyFormModel";

type ApplicationMetadata = Record<string, unknown>;

export function formatWorkPreferencesFromMetadata(metadata: ApplicationMetadata): string {
  const prefs = metadata.work_preferences;
  if (!Array.isArray(prefs)) return "";
  return prefs
    .map((p) => CLEANER_APPLY_WORK_PREFERENCE_LABELS[p as CleanerApplyWorkPreference] ?? p)
    .join(", ");
}

export function formatSkillsFromMetadata(metadata: ApplicationMetadata): string[] {
  const skills = metadata.skills;
  if (!skills || typeof skills !== "object") return [];
  const labels: string[] = [];
  for (const [key, value] of Object.entries(skills as Record<string, boolean>)) {
    if (value && key in CLEANER_APPLY_SKILL_LABELS) {
      labels.push(CLEANER_APPLY_SKILL_LABELS[key as CleanerApplySkillKey]);
    }
  }
  return labels;
}

export function formatReferencesFromMetadata(
  metadata: ApplicationMetadata,
): { name: string; phone: string }[] {
  const refs = metadata.references;
  if (!Array.isArray(refs)) return [];
  return refs.filter(
    (r): r is { name: string; phone: string } =>
      typeof r === "object" &&
      r !== null &&
      typeof (r as { name?: string }).name === "string" &&
      typeof (r as { phone?: string }).phone === "string",
  );
}
