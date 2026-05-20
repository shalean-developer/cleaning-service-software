/**
 * Safe heuristics for mock / test customer identities.
 * Used by ops:audit:mock-customers and ops:delete:mock-customers only.
 */

import { isE2eCompanyName, isE2eEmail } from "../../e2e/lib/constants.mjs";

/** Never classify or delete these production inboxes. */
export const PROTECTED_CUSTOMER_EMAILS = new Set([
  "admin@shalean.co.za",
]);

/** @typedef {{ mock: boolean; reasons: string[]; strong: boolean }} MockCustomerClassification */

/**
 * @param {string | null | undefined} email
 */
export function isMockCustomerEmail(email) {
  if (typeof email !== "string" || !email.includes("@")) return false;
  const e = email.toLowerCase().trim();
  if (PROTECTED_CUSTOMER_EMAILS.has(e)) return false;
  if (e.startsWith("purged+") && e.endsWith("@invalid.local")) return true;
  if (isE2eEmail(e)) return true;
  if (e.includes("test_")) return true;
  if (e.includes("e2e")) return true;
  if (e.includes("phase")) return true;
  if (e.includes("mock")) return true;
  if (e.includes("demo")) return true;
  if (e.endsWith("@invalid.local")) return true;
  if (e.includes("example.com")) return true;
  if (e.includes("temp")) return true;
  if (e.includes("fake")) return true;
  return false;
}

/**
 * @param {string | null | undefined} value
 */
export function isMockCustomerDisplayName(value) {
  if (typeof value !== "string" || !value.trim()) return false;
  const n = value.toLowerCase();
  if (n.includes("test_e2e") || n.includes("test_phase")) return true;
  if (/\be2e\s+test\b/.test(n)) return true;
  if (/\b(mock|demo)\s+customer\b/.test(n)) return true;
  if (/\btest\b/.test(n) && (n.includes("customer") || n.includes("integration"))) return true;
  if (n.includes("e2e")) return true;
  if (n.includes("phase") && n.includes("integration")) return true;
  if (/\b(mock|demo)\b/.test(n)) return true;
  return false;
}

/**
 * @param {string | null | undefined} companyName
 */
export function isMockCustomerCompanyName(companyName) {
  if (typeof companyName !== "string" || !companyName.trim()) return false;
  if (isE2eCompanyName(companyName)) return true;
  const n = companyName.toLowerCase();
  if (n.startsWith("test_phase")) return true;
  if (n.includes("test_")) return true;
  if (n.includes("e2e")) return true;
  if (n.includes("mock")) return true;
  if (n.includes("demo")) return true;
  return false;
}

/**
 * @param {string | null | undefined} phone
 */
export function isMockCustomerPhone(phone) {
  if (typeof phone !== "string" || !phone.trim()) return false;
  const p = phone.toLowerCase().replace(/\s+/g, "");
  if (p.startsWith("test_e2e") || p.includes("test_phase")) return true;
  if (p.includes("e2e") && p.includes("test")) return true;
  if (p === "0000000000" || p === "+0000000000") return true;
  if (/^\+?0{6,}$/.test(p)) return true;
  if (p.includes("fake") || p.includes("placeholder")) return true;
  if (p.includes("5550100") || p.includes("555-0100")) return true;
  return false;
}

/**
 * Strong mock = safe to remove paid test bookings (E2E / phase integration seeds).
 * @param {{ email?: string | null; companyName?: string | null }} input
 */
export function isStrongMockCustomerSignal(input) {
  if (isE2eEmail(input.email)) return true;
  if (isE2eCompanyName(input.companyName)) return true;
  const company = (input.companyName ?? "").toLowerCase();
  if (company.startsWith("test_phase")) return true;
  const email = (input.email ?? "").toLowerCase();
  if (email.includes("test_phase") || email.includes("phase1_integration")) return true;
  return false;
}

/**
 * @param {{
 *   email?: string | null;
 *   fullName?: string | null;
 *   companyName?: string | null;
 *   phone?: string | null;
 *   hasOnlyPhaseTestBookings?: boolean;
 * }} input
 * @returns {MockCustomerClassification}
 */
export function classifyMockCustomer(input) {
  const reasons = [];
  if (input.email && PROTECTED_CUSTOMER_EMAILS.has(input.email.toLowerCase().trim())) {
    return { mock: false, reasons: ["protected"], strong: false };
  }
  if (isMockCustomerEmail(input.email)) reasons.push("email");
  if (isMockCustomerDisplayName(input.fullName)) reasons.push("name");
  if (isMockCustomerCompanyName(input.companyName)) reasons.push("company");
  if (isMockCustomerPhone(input.phone)) reasons.push("phone");
  if (input.hasOnlyPhaseTestBookings) reasons.push("phase_bookings");
  const strong = isStrongMockCustomerSignal({
    email: input.email,
    companyName: input.companyName,
  });
  return { mock: reasons.length > 0, reasons, strong };
}

/**
 * @param {MockCustomerClassification} classification
 * @param {{ paidProductionBookings: number; customerAuditCount: number }} safety
 * @returns {"DELETE" | "KEEP" | "REVIEW" | "PURGED"}
 */
export function resolveMockCustomerDecision(classification, safety, alreadyPurged) {
  if (alreadyPurged) return "PURGED";
  if (!classification.mock) return "KEEP";
  if (safety.paidProductionBookings > 0 && !classification.strong) return "REVIEW";
  if (safety.paidProductionBookings > 0 && classification.strong) return "DELETE";
  return "DELETE";
}
