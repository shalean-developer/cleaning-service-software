/**
 * Safe heuristics for mock / test customer identities.
 * Used by ops:audit:mock-customers and ops:delete:mock-customers only.
 */

import { isE2eCompanyName, isE2eEmail } from "../../e2e/lib/constants.mjs";

/** Shalean production domain — KEEP unless email has explicit test/mock markers. */
export const SHALEAN_CUSTOMER_DOMAIN = "@shalean.co.za";

/** Never classify or delete these production inboxes. */
export const PROTECTED_CUSTOMER_EMAILS = new Set([
  "admin@shalean.co.za",
  "customer@shalean.co.za",
  "chitekedzaf@gmail.com",
]);

const REAL_CUSTOMER_NAME_MARKERS = [/farai\s+chitekedzai/i];

/**
 * @param {string | null | undefined} email
 */
export function isShaleanCoZaCustomerEmail(email) {
  if (typeof email !== "string" || !email.includes("@")) return false;
  return email.toLowerCase().trim().endsWith(SHALEAN_CUSTOMER_DOMAIN);
}

/**
 * Explicit test/mock signal on the email local-part (required to DELETE @shalean.co.za accounts).
 * @param {string | null | undefined} email
 */
export function hasExplicitMockCustomerEmail(email) {
  if (!isShaleanCoZaCustomerEmail(email)) return isMockCustomerEmail(email);
  if (typeof email !== "string") return false;
  const e = email.toLowerCase().trim();
  if (PROTECTED_CUSTOMER_EMAILS.has(e)) return false;
  if (isE2eEmail(e)) return true;
  if (e.includes("test_")) return true;
  if (e.includes("e2e")) return true;
  if (e.includes("phase")) return true;
  if (e.includes("mock")) return true;
  if (e.includes("demo")) return true;
  return false;
}

/** @typedef {{ mock: boolean; reasons: string[]; strong: boolean }} MockCustomerClassification */

/**
 * @param {string | null | undefined} email
 */
export function isMockCustomerEmail(email) {
  if (typeof email !== "string" || !email.includes("@")) return false;
  const e = email.toLowerCase().trim();
  if (PROTECTED_CUSTOMER_EMAILS.has(e)) return false;
  if (isShaleanCoZaCustomerEmail(e) && !hasExplicitMockCustomerEmail(e)) return false;
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
 * @param {{ fullName?: string | null }} input
 */
export function isProtectedRealCustomerName(input) {
  const name = (input.fullName ?? "").trim();
  if (!name) return false;
  return REAL_CUSTOMER_NAME_MARKERS.some((re) => re.test(name));
}

/**
 * @param {{
 *   email?: string | null;
 *   fullName?: string | null;
 *   companyName?: string | null;
 *   phone?: string | null;
 *   hasOnlyPhaseTestBookings?: boolean;
 *   linkedProfileMock?: boolean;
 * }} input
 * @returns {MockCustomerClassification}
 */
export function classifyMockCustomer(input) {
  const reasons = [];
  const email = input.email?.toLowerCase().trim() ?? "";
  if (email && PROTECTED_CUSTOMER_EMAILS.has(email)) {
    return { mock: false, reasons: ["protected"], strong: false };
  }
  if (isProtectedRealCustomerName({ fullName: input.fullName })) {
    return { mock: false, reasons: ["protected"], strong: false };
  }

  if (isMockCustomerEmail(input.email)) reasons.push("email");
  if (isMockCustomerCompanyName(input.companyName)) reasons.push("company");
  if (input.linkedProfileMock) reasons.push("linked_profile");

  const shaleanWithoutExplicitEmail =
    isShaleanCoZaCustomerEmail(email) && !hasExplicitMockCustomerEmail(email);

  if (!shaleanWithoutExplicitEmail) {
    if (isMockCustomerDisplayName(input.fullName)) reasons.push("name");
    if (isMockCustomerPhone(input.phone)) reasons.push("phone");
  } else {
    const company = (input.companyName ?? "").toLowerCase();
    if (company.startsWith("test_phase") || isE2eCompanyName(input.companyName)) {
      /* company / E2E company already counted */
    } else if (isMockCustomerPhone(input.phone)) {
      reasons.push("phone");
    }
  }

  if (input.hasOnlyPhaseTestBookings) reasons.push("phase_bookings");

  const strong = isStrongMockCustomerSignal({
    email: input.email,
    companyName: input.companyName,
  });

  if (shaleanWithoutExplicitEmail && reasons.length > 0) {
    const shaleanSafe =
      reasons.every((r) => r === "company" || r === "linked_profile" || r === "phase_bookings") &&
      (reasons.includes("company") || reasons.includes("linked_profile"));
    if (!shaleanSafe) {
      const filtered = reasons.filter((r) => r !== "name" && r !== "phone");
      return {
        mock: filtered.length > 0,
        reasons: filtered.length ? filtered : ["shalean_production_email"],
        strong: filtered.some((r) => r === "company") ? true : strong,
      };
    }
  }

  return { mock: reasons.length > 0, reasons, strong: strong || reasons.includes("company") };
}

/**
 * @param {MockCustomerClassification} classification
 * @param {{ paidProductionBookings: number; customerAuditCount: number }} safety
 * @returns {"DELETE" | "KEEP" | "REVIEW" | "PURGED"}
 */
export function resolveMockCustomerDecision(classification, safety, alreadyPurged, email) {
  if (alreadyPurged) return "PURGED";
  if (
    email &&
    isShaleanCoZaCustomerEmail(email) &&
    !hasExplicitMockCustomerEmail(email)
  ) {
    return "KEEP";
  }
  if (!classification.mock) return "KEEP";
  if (safety.paidProductionBookings > 0 && !classification.strong) return "REVIEW";
  if (safety.paidProductionBookings > 0 && classification.strong) return "DELETE";
  return "DELETE";
}
