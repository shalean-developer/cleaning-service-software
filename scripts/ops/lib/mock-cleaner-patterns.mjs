/**
 * Safe heuristics for mock / test cleaner identities.
 * Used by ops:audit:mock-cleaners and ops:delete:mock-cleaners only.
 */

/** @typedef {{ mock: boolean; reasons: string[] }} MockCleanerClassification */

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
  if (e.includes("test_e2e")) return true;
  if (e.includes("test_phase")) return true;
  if (/\b(mock|demo)\b/.test(e)) return true;
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
  const n = fullName.toLowerCase();
  if (n.includes("test_e2e") || n.includes("test_phase")) return true;
  if (/\be2e\s+test\b/.test(n)) return true;
  if (/\b(mock|demo)\s+cleaner\b/.test(n)) return true;
  if (/^phase\s+2\s+/i.test(fullName.trim())) return true;
  return false;
}

/**
 * @param {string | null | undefined} phone
 */
export function isMockCleanerPhone(phone) {
  if (typeof phone !== "string") return false;
  const p = phone.toLowerCase();
  return p.startsWith("test_e2e_") || p.includes("test_phase");
}

/**
 * @param {{ email?: string | null; fullName?: string | null; phone?: string | null }} input
 * @returns {MockCleanerClassification}
 */
export function classifyMockCleaner(input) {
  const reasons = [];
  if (isMockCleanerEmail(input.email)) reasons.push("email");
  if (isMockCleanerDisplayName(input.fullName)) reasons.push("name");
  if (isMockCleanerPhone(input.phone)) reasons.push("phone");
  return { mock: reasons.length > 0, reasons };
}
