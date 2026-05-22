/**
 * Centralized mock / test / demo classification for ops mock-data cleanup.
 */

import { isE2eEmail } from "../../e2e/lib/constants.mjs";
import {
  classifyMockCustomer,
  isMockCustomerEmail,
  isStrongMockCustomerSignal,
  PROTECTED_CUSTOMER_EMAILS,
  hasExplicitMockCustomerEmail,
  isShaleanCoZaCustomerEmail,
  resolveMockCustomerDecision,
} from "./mock-customer-patterns.mjs";
import { classifyMockCleaner, isMockCleanerEmail } from "./mock-cleaner-patterns.mjs";
import {
  classifyMockProfile,
  isMockProfileDisplayName,
  resolveMockProfileDecision,
} from "./mock-profile-patterns.mjs";

export {
  classifyMockCustomer,
  classifyMockCleaner,
  classifyMockProfile,
  isMockCustomerEmail,
  isMockCleanerEmail,
  isMockProfileDisplayName,
  isStrongMockCustomerSignal,
  PROTECTED_CUSTOMER_EMAILS,
  hasExplicitMockCustomerEmail,
  isShaleanCoZaCustomerEmail,
  resolveMockCustomerDecision,
  resolveMockProfileDecision,
};

/** Never auto-delete these operational inboxes (any role). */
export const PROTECTED_OPERATIONAL_EMAILS = new Set([
  ...PROTECTED_CUSTOMER_EMAILS,
  "admin@shalean.co.za",
]);

export const MOCK_TEXT_TOKENS = [
  "test_phase",
  "test_phase1",
  "test_phase2",
  "test_e2e",
  "phase1",
  "phase2",
  "phase",
  "e2e",
  "sandbox",
  "mock",
  "demo",
  "integration_seed",
  "integration seed",
];

const PAID_PAYMENT_STATUSES = new Set(["paid", "success", "completed"]);
const COMPLETED_PAYOUT_STATUSES = new Set(["paid", "payout_ready"]);

/**
 * @param {string | null | undefined} value
 */
export function containsMockToken(value) {
  if (typeof value !== "string" || !value.trim()) return false;
  const v = value.toLowerCase();
  return MOCK_TEXT_TOKENS.some((t) => v.includes(t));
}

/**
 * @param {Record<string, unknown> | null | undefined} metadata
 */
export function isMockBookingMetadata(metadata) {
  if (!metadata || typeof metadata !== "object") return false;
  const serialized = JSON.stringify(metadata).toLowerCase();
  return MOCK_TEXT_TOKENS.some((t) => serialized.includes(t));
}

/**
 * @param {Record<string, unknown> | null | undefined} metadata
 */
export function extractBookingFieldSignals(metadata) {
  if (!metadata || typeof metadata !== "object") {
    return { serviceUid: null, customerEmail: null, customerName: null };
  }
  const m = /** @type {Record<string, unknown>} */ (metadata);
  const serviceUid =
    (typeof m.service_uid === "string" && m.service_uid) ||
    (typeof m.serviceUid === "string" && m.serviceUid) ||
    null;
  const customerEmail =
    (typeof m.customer_email === "string" && m.customer_email) ||
    (typeof m.customerEmail === "string" && m.customerEmail) ||
    null;
  const customerName =
    (typeof m.customer_name === "string" && m.customer_name) ||
    (typeof m.customerName === "string" && m.customerName) ||
    null;
  return { serviceUid, customerEmail, customerName };
}

/**
 * @param {{
 *   metadata?: Record<string, unknown> | null;
 *   serviceUid?: string | null;
 *   customerEmail?: string | null;
 *   customerName?: string | null;
 *   customerId?: string | null;
 *   cleanerId?: string | null;
 *   mockCustomerIds?: Set<string>;
 *   mockCleanerIds?: Set<string>;
 * }} input
 */
export function classifyMockBookingSignals(input) {
  const reasons = [];
  const extracted = extractBookingFieldSignals(input.metadata);
  const serviceUid = input.serviceUid ?? extracted.serviceUid;
  const customerEmail = input.customerEmail ?? extracted.customerEmail;
  const customerName = input.customerName ?? extracted.customerName;

  if (isMockBookingMetadata(input.metadata)) reasons.push("metadata");
  if (containsMockToken(serviceUid)) reasons.push("service_uid");
  if (containsMockToken(customerEmail)) reasons.push("customer_email");
  if (containsMockToken(customerName)) reasons.push("customer_name");
  if (input.customerId && input.mockCustomerIds?.has(input.customerId)) {
    reasons.push("mock_customer");
  }
  if (input.cleanerId && input.mockCleanerIds?.has(input.cleanerId)) {
    reasons.push("mock_cleaner");
  }

  return { mock: reasons.length > 0, reasons, strong: reasons.includes("mock_customer") };
}

/**
 * @param {string | null | undefined} status
 */
export function isPaidProductionPaymentStatus(status) {
  if (typeof status !== "string") return false;
  return PAID_PAYMENT_STATUSES.has(status.toLowerCase());
}

/**
 * @param {string | null | undefined} providerRef
 * @param {string | null | undefined} idempotencyKey
 */
export function isMockPaymentReference(providerRef, idempotencyKey) {
  return containsMockToken(providerRef) || containsMockToken(idempotencyKey);
}

/**
 * @param {{
 *   status: string;
 *   metadata?: Record<string, unknown> | null;
 *   serviceUid?: string | null;
 *   customerEmail?: string | null;
 *   customerName?: string | null;
 *   customerId?: string | null;
 *   cleanerId?: string | null;
 *   customerClassification: import('./mock-customer-patterns.mjs').MockCustomerClassification;
 *   mockCustomerIds?: Set<string>;
 *   mockCleanerIds?: Set<string>;
 *   hasPaidPayment?: boolean;
 *   hasCompletedPayoutEarning?: boolean;
 * }} input
 * @returns {"DELETE" | "KEEP" | "REVIEW"}
 */
export function resolveMockBookingDecision(input) {
  const bookingSignals = classifyMockBookingSignals({
    metadata: input.metadata,
    serviceUid: input.serviceUid,
    customerEmail: input.customerEmail,
    customerName: input.customerName,
    customerId: input.customerId,
    cleanerId: input.cleanerId,
    mockCustomerIds: input.mockCustomerIds,
    mockCleanerIds: input.mockCleanerIds,
  });

  const cc = input.customerClassification;
  const clearlyMock =
    bookingSignals.mock ||
    cc.mock ||
    (input.customerId && input.mockCustomerIds?.has(input.customerId));

  if (!clearlyMock) return "KEEP";

  const strongCustomer =
    cc.strong ||
    isStrongMockCustomerSignal({
      email: input.customerEmail,
      companyName: null,
    }) ||
    (input.customerId != null && input.mockCustomerIds?.has(input.customerId) === true);

  if (input.hasCompletedPayoutEarning) return "REVIEW";

  if (input.hasPaidPayment && !strongCustomer) return "REVIEW";

  if (cc.mock && cc.strong) return "DELETE";
  if (strongCustomer && bookingSignals.mock) return "DELETE";
  if (["draft", "cancelled", "payment_failed"].includes(input.status) && bookingSignals.mock) {
    return "DELETE";
  }
  if (bookingSignals.mock && !input.hasPaidPayment) return "DELETE";
  if (input.hasPaidPayment) return "REVIEW";
  return clearlyMock ? "REVIEW" : "KEEP";
}

/**
 * @param {{
 *   classification: import('./mock-cleaner-patterns.mjs').MockCleanerClassification;
 *   paidRealCustomerBookings?: number;
 *   completedJobCount?: number;
 *   payoutEarningCount?: number;
 *   alreadyPurged?: boolean;
 * }} input
 * @returns {"DELETE" | "KEEP" | "REVIEW" | "PURGED"}
 */
export function resolveMockCleanerDecision(input) {
  if (input.alreadyPurged) return "PURGED";
  if (input.classification.protected) return "KEEP";
  if (!input.classification.mock) return "KEEP";
  if ((input.paidRealCustomerBookings ?? 0) > 0) return "REVIEW";
  if ((input.completedJobCount ?? 0) > 0) return "REVIEW";
  if ((input.payoutEarningCount ?? 0) > 0) return "REVIEW";
  return "DELETE";
}

/**
 * @param {string | null | undefined} email
 */
export function isProtectedOperationalEmail(email) {
  if (typeof email !== "string") return false;
  const e = email.toLowerCase().trim();
  return PROTECTED_OPERATIONAL_EMAILS.has(e);
}

/**
 * @param {string | null | undefined} payoutStatus
 * @param {string | null | undefined} payoutBatchId
 */
export function isCompletedPayoutEarning(payoutStatus, payoutBatchId) {
  if (payoutBatchId) return true;
  if (typeof payoutStatus !== "string") return false;
  return COMPLETED_PAYOUT_STATUSES.has(payoutStatus.toLowerCase());
}
