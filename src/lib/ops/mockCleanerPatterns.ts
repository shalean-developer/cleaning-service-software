/** Mirrors scripts/ops/lib/mock-cleaner-patterns.mjs. keep classification in sync. */

const PROTECTED_CLEANER_NAME_MARKERS = [/^princess\s+saidi$/i, /^farai\s+chitekedza$/i];

export function isProtectedRealCleanerName(fullName: string | null | undefined): boolean {
  const name = (fullName ?? "").trim();
  if (!name) return false;
  return PROTECTED_CLEANER_NAME_MARKERS.some((re) => re.test(name));
}

export function isMockCleanerEmail(email: string | null | undefined): boolean {
  if (typeof email !== "string" || !email.includes("@")) return false;
  const e = email.toLowerCase();
  if (e.startsWith("purged+") && e.endsWith("@invalid.local")) return true;
  if (e.includes("test_e2e")) return true;
  if (e.includes("test_phase")) return true;
  if (/\b(mock|demo)\b/.test(e)) return true;
  if (/\.(mock|demo)@/i.test(e)) return true;
  if (/^(mock|demo)@/i.test(e)) return true;
  if (/[+._](mock|demo)@/i.test(e)) return true;
  return false;
}

export function isMockCleanerDisplayName(fullName: string | null | undefined): boolean {
  if (typeof fullName !== "string" || !fullName.trim()) return false;
  if (isProtectedRealCleanerName(fullName)) return false;
  const n = fullName.toLowerCase();
  if (n.includes("test_e2e") || n.includes("test_phase")) return true;
  if (/\be2e\s+test\b/.test(n)) return true;
  if (/\b(mock|demo)\s+cleaner\b/.test(n)) return true;
  if (/^phase\s+2\s+/i.test(fullName.trim())) return true;
  return false;
}

export function isMockCleanerPhone(phone: string | null | undefined): boolean {
  if (typeof phone !== "string") return false;
  const p = phone.toLowerCase();
  return p.startsWith("test_e2e_") || p.includes("test_phase");
}

export function isMockCleanerIdentity(input: {
  email?: string | null;
  fullName?: string | null;
  phone?: string | null;
}): boolean {
  return (
    isMockCleanerEmail(input.email) ||
    isMockCleanerDisplayName(input.fullName) ||
    isMockCleanerPhone(input.phone)
  );
}
