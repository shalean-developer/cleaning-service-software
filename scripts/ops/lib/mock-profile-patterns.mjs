/**
 * Profile-level mock / test / demo classification for unified ops mock-data cleanup.
 */

import { isE2eEmail } from "../../e2e/lib/constants.mjs";
import {
  PROTECTED_CUSTOMER_EMAILS,
  hasExplicitMockCustomerEmail,
  isShaleanCoZaCustomerEmail,
} from "./mock-customer-patterns.mjs";

/** Never auto-delete these operational / real-person inboxes. */
export const PROTECTED_PROFILE_EMAILS = new Set([
  ...PROTECTED_CUSTOMER_EMAILS,
  "chitekedzaf@gmail.com",
]);

const REAL_PERSON_NAME_MARKERS = [/farai\s+chitekedzai/i];

/**
 * @param {string | null | undefined} email
 */
export function normalizeEmail(email) {
  return typeof email === "string" ? email.toLowerCase().trim() : "";
}

/**
 * @param {{ email?: string | null; fullName?: string | null }} input
 */
export function isProtectedRealPerson(input) {
  const email = normalizeEmail(input.email);
  if (email && PROTECTED_PROFILE_EMAILS.has(email)) return true;
  const name = (input.fullName ?? "").trim();
  if (!name) return false;
  return REAL_PERSON_NAME_MARKERS.some((re) => re.test(name));
}

/**
 * @param {string | null | undefined} fullName
 */
export function isMockProfileDisplayName(fullName) {
  if (typeof fullName !== "string" || !fullName.trim()) return false;
  const n = fullName.toLowerCase();
  if (/\bphase\s*2\b/.test(n)) return true;
  if (n.includes("integration seed")) return true;
  if (/\be2e\b/.test(n)) return true;
  if (/\btest\b/.test(n) && (n.includes("customer") || n.includes("cleaner") || n.includes("admin"))) {
    return true;
  }
  if (/\b(mock|demo)\b/.test(n)) return true;
  if (n.includes("test_e2e") || n.includes("test_phase")) return true;
  return false;
}

/**
 * Explicit test marker on email (required to treat bare @shalean.co.za as mock).
 * @param {string | null | undefined} email
 */
export function hasExplicitTestProfileEmail(email) {
  if (!email) return false;
  if (isProtectedRealPerson({ email })) return false;
  if (isE2eEmail(email)) return true;
  return hasExplicitMockCustomerEmail(email);
}

/**
 * Strong display-name markers (safe to treat @shalean.co.za profiles as mock).
 * @param {string | null | undefined} fullName
 */
export function isStrongProfileNameMarker(fullName) {
  if (typeof fullName !== "string" || !fullName.trim()) return false;
  const n = fullName.toLowerCase();
  if (/\bphase\s*2\b/.test(n)) return true;
  if (n.includes("integration seed")) return true;
  if (/\be2e\b/.test(n)) return true;
  if (n.includes("test_e2e") || n.includes("test_phase")) return true;
  return false;
}

/**
 * @param {{
 *   email?: string | null;
 *   fullName?: string | null;
 *   role?: string | null;
 * }} input
 * @returns {{ mock: boolean; reasons: string[]; protected: boolean }}
 */
export function classifyMockProfile(input) {
  if (isProtectedRealPerson(input)) {
    return { mock: false, reasons: ["protected"], protected: true };
  }

  const reasons = [];
  const email = normalizeEmail(input.email);
  const role = (input.role ?? "").toLowerCase();

  if (hasExplicitTestProfileEmail(email)) reasons.push("email");
  if (isMockProfileDisplayName(input.fullName)) reasons.push("name");

  if (isShaleanCoZaCustomerEmail(email) && !hasExplicitTestProfileEmail(email)) {
    if (reasons.includes("name") && !isStrongProfileNameMarker(input.fullName)) {
      const idx = reasons.indexOf("name");
      reasons.splice(idx, 1);
    }
    if (reasons.length === 0) {
      return { mock: false, reasons: ["shalean_production_email"], protected: false };
    }
  }

  const roleHasTestName =
    ["customer", "admin", "cleaner"].includes(role) &&
    reasons.includes("name") &&
    isStrongProfileNameMarker(input.fullName);

  if (
    reasons.length > 0 &&
    (reasons.includes("email") || roleHasTestName || reasons.length > 1)
  ) {
    return { mock: true, reasons, protected: false };
  }

  if (reasons.includes("name")) {
    return { mock: true, reasons, protected: false };
  }

  return { mock: false, reasons: [], protected: false };
}

/**
 * @param {{ mock: boolean; protected: boolean }} classification
 * @returns {"DELETE" | "KEEP" | "REVIEW"}
 */
export function resolveMockProfileDecision(classification) {
  if (classification.protected) return "KEEP";
  if (!classification.mock) return "KEEP";
  return "DELETE";
}
