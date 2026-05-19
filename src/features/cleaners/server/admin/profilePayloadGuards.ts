/** Lifecycle columns — never accepted on profile create/update payloads. */
export const LIFECYCLE_PAYLOAD_KEYS = [
  "active",
  "suspended_at",
  "suspensionEndsAt",
  "suspension_ends_at",
  "deleted_at",
  "deletedAt",
  "onboarding_completed_at",
  "onboardingCompletedAt",
  "lifecycle_reason",
  "lifecycleReason",
  "archived",
  "suspended",
] as const;

/** Immutable or auth-managed fields — rejected on profile update (v1). */
export const IMMUTABLE_PROFILE_EDIT_KEYS = [
  "phone",
  "password",
  "confirmPassword",
  "email",
  "authEmail",
] as const;

export function findForbiddenLifecycleKeys(body: Record<string, unknown>): string[] {
  return LIFECYCLE_PAYLOAD_KEYS.filter((key) => key in body);
}

export function findForbiddenImmutableProfileKeys(body: Record<string, unknown>): string[] {
  return IMMUTABLE_PROFILE_EDIT_KEYS.filter((key) => key in body);
}
