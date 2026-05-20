/** Display-only helpers for profile avatar and initials (no auth or API changes). */

export function resolveProfileAvatarUrl(
  userMetadata: Record<string, unknown> | null | undefined,
): string | null {
  if (!userMetadata) return null;

  for (const key of ["avatar_url", "picture", "photo_url"] as const) {
    const value = userMetadata[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return null;
}

export function resolveProfileInitials(
  fullName: string | null | undefined,
  email: string | null | undefined,
): string {
  const trimmedName = fullName?.trim();
  if (trimmedName) {
    const parts = trimmedName.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return `${parts[0]![0] ?? ""}${parts[parts.length - 1]![0] ?? ""}`.toUpperCase();
    }
    if (parts[0]) {
      return parts[0].slice(0, 2).toUpperCase();
    }
  }

  const local = email?.split("@")[0]?.replace(/[^a-zA-Z0-9]/g, "") ?? "";
  if (local.length >= 2) return local.slice(0, 2).toUpperCase();
  if (local.length === 1) return local.toUpperCase();
  return "?";
}
