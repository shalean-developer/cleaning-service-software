import "server-only";

import { DEFAULT_ASSIGNMENT_DISPATCH_LEAD_DAYS } from "../dispatchAtConstants";

export { DEFAULT_ASSIGNMENT_DISPATCH_LEAD_DAYS };

export type DeferredAssignmentConfig = {
  enabled: boolean;
  dispatchLeadDays: number;
};

function parseBooleanEnv(raw: string | undefined, defaultValue: boolean): boolean {
  if (raw == null || raw.trim() === "") return defaultValue;
  const normalized = raw.trim().toLowerCase();
  if (normalized === "true" || normalized === "1" || normalized === "yes") return true;
  if (normalized === "false" || normalized === "0" || normalized === "no") return false;
  return defaultValue;
}

function parsePositiveIntEnv(raw: string | undefined, defaultValue: number): number {
  if (raw == null || raw.trim() === "") return defaultValue;
  const parsed = Number.parseInt(raw.trim(), 10);
  if (!Number.isFinite(parsed) || parsed < 0) return defaultValue;
  return parsed;
}

/** Reads deferred-assignment feature flags (defaults: disabled, 14-day lead). */
export function getDeferredAssignmentConfig(
  env: NodeJS.ProcessEnv = process.env,
): DeferredAssignmentConfig {
  return {
    enabled: parseBooleanEnv(env.DEFERRED_ASSIGNMENT_ENABLED, false),
    dispatchLeadDays: parsePositiveIntEnv(
      env.ASSIGNMENT_DISPATCH_LEAD_DAYS,
      DEFAULT_ASSIGNMENT_DISPATCH_LEAD_DAYS,
    ),
  };
}
