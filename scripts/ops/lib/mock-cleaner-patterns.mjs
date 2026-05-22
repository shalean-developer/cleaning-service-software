/**
 * Safe heuristics for mock / test cleaner identities.
 * Used by ops:audit:mock-cleaners, ops:delete:mock-cleaners, and unified mock-data cleanup.
 */

/** Production cleaners — never classify or delete. */
export const PROTECTED_CLEANER_NAME_MARKERS = [
  /^princess\s+saidi$/i,
  /^farai\s+chitekedza$/i,
];

/** @typedef {{ mock: boolean; reasons: string[]; protected?: boolean }} MockCleanerClassification */

/**
 * @param {{ fullName?: string | null }} input
 */
export function isProtectedRealCleanerName(input) {
  const name = (input.fullName ?? "").trim();
  if (!name) return false;
  return PROTECTED_CLEANER_NAME_MARKERS.some((re) => re.test(name));
}

/**
 * @param {string | null | undefined} companyName
 */
export function isTestCustomerCompanyName(companyName) {
  if (typeof companyName !== "string") return false;
  const n = companyName.toLowerCase();
  return n.startsWith("test_e2e_") || n.includes("test_phase");
}

/**
 * @param {string | null | undefined} email
 */
export function isMockCleanerEmail(email) {
  if (typeof email !== "string" || !email.includes("@")) return false;
  const e = email.toLowerCase();
  if (e.startsWith("purged+") && e.endsWith("@invalid.local")) return true;
  if (e.includes("example.com")) return true;
  if (e.includes("invalid.local")) return true;
  if (e.includes("test_e2e")) return true;
  if (e.includes("test_phase")) return true;
  if (/\b(test|mock|demo|e2e|phase)\b/.test(e)) return true;
  if (/\.(mock|demo)@/i.test(e)) return true;
  if (/^(mock|demo)@/i.test(e)) return true;
  if (/[+._](mock|demo)@/i.test(e)) return true;
  return false;
}

/**
 * @param {string | null | undefined} fullName
 */
export function isMockCleanerDisplayName(fullName) {
  if (typeof fullName !== "string" || !fullName.trim()) return false;
  if (isProtectedRealCleanerName({ fullName })) return false;
  const n = fullName.toLowerCase();
  if (n.includes("test_e2e") || n.includes("test_phase")) return true;
  if (/\be2e\s+test\b/.test(n)) return true;
  if (/\b(mock|demo)\s+cleaner\b/.test(n)) return true;
  if (/^phase\s+2\s+/i.test(fullName.trim())) return true;
  if (/\b(test|mock|demo|e2e|phase)\b/.test(n)) return true;
  return false;
}

/**
 * @param {string | null | undefined} phone
 */
export function isMockCleanerPhone(phone) {
  if (typeof phone !== "string") return false;
  const p = phone.toLowerCase();
  if (p.startsWith("test_e2e_") || p.includes("test_phase")) return true;
  return /\b(test|mock|demo|e2e|phase)\b/.test(p);
}

/**
 * @param {{ email?: string | null; fullName?: string | null; phone?: string | null; linkedProfileMock?: boolean }} input
 * @returns {MockCleanerClassification}
 */
export function classifyMockCleaner(input) {
  if (isProtectedRealCleanerName({ fullName: input.fullName })) {
    return { mock: false, reasons: ["protected"], protected: true };
  }
  const reasons = [];
  if (isMockCleanerEmail(input.email)) reasons.push("email");
  if (isMockCleanerDisplayName(input.fullName)) reasons.push("name");
  if (isMockCleanerPhone(input.phone)) reasons.push("phone");
  if (input.linkedProfileMock) reasons.push("linked_profile");
  return { mock: reasons.length > 0, reasons, protected: false };
}
