import { isE2eCompanyName } from "../../e2e/lib/constants.mjs";
import { listAuthEmailsForProfileIds } from "./customer-domain-audit.mjs";
import {
  classifyMockCustomer,
  isStrongMockCustomerSignal,
  PROTECTED_CUSTOMER_EMAILS,
  resolveMockCustomerDecision,
} from "./mock-customer-patterns.mjs";

const PAID_PAYMENT_STATUS = "paid";
const PURGED_EMAIL_SUFFIX = "@invalid.local";

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} client
 */
export async function loadCustomerCandidates(client) {
  const { data: profiles, error: profileErr } = await client
    .from("profiles")
    .select("id, role, full_name")
    .eq("role", "customer");
  if (profileErr) throw profileErr;

  const { data: customers, error: customerErr } = await client
    .from("customers")
    .select("id, profile_id, company_name, phone, notes, created_at");
  if (customerErr) throw customerErr;

  const profileIds = (profiles ?? []).map((p) => p.id);
  const authEmails = await listAuthEmailsForProfileIds(client, profileIds);
  const customerByProfile = new Map((customers ?? []).map((c) => [c.profile_id, c]));

  const rows = [];
  for (const profile of profiles ?? []) {
    const customer = customerByProfile.get(profile.id);
    if (!customer) {
      rows.push({
        customerId: null,
        userId: profile.id,
        email: authEmails.get(profile.id) ?? "(no auth email)",
        displayName: profile.full_name,
        phone: null,
        companyName: null,
        status: "orphan_profile",
        classification: { mock: false, reasons: ["no_customer_row"], strong: false },
      });
      continue;
    }

    const email = authEmails.get(profile.id) ?? null;
    const classification = classifyMockCustomer({
      email,
      fullName: profile.full_name,
      companyName: customer.company_name,
      phone: customer.phone,
    });

    const alreadyPurged =
      typeof email === "string" &&
      email.toLowerCase().startsWith("purged+") &&
      email.toLowerCase().endsWith(PURGED_EMAIL_SUFFIX);

    rows.push({
      customerId: customer.id,
      userId: profile.id,
      email: email ?? "(no auth email)",
      displayName: profile.full_name ?? customer.company_name ?? "—",
      phone: customer.phone,
      companyName: customer.company_name,
      status: alreadyPurged ? "purged" : "active",
      classification,
      alreadyPurged,
    });
  }

  return rows;
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} client
 * @param {string} customerId
 * @param {{ needsBookingRows?: boolean }} [options]
 */
export async function countCustomerRelatedRows(client, customerId, options = {}) {
  const countEq = async (table, column, value) => {
    const { count, error } = await client
      .from(table)
      .select("id", { count: "exact", head: true })
      .eq(column, value);
    if (error) throw error;
    return count ?? 0;
  };

  const bookingCount = await countEq("bookings", "customer_id", customerId);

  const { count: recurringCount, error: recurringErr } = await client
    .from("bookings")
    .select("id", { count: "exact", head: true })
    .eq("customer_id", customerId)
    .not("series_id", "is", null);
  if (recurringErr) throw recurringErr;

  let bookingRows = [];
  let bookingIds = [];
  let paymentCount = 0;
  let paidPaymentCount = 0;

  const needsBookingRows = options.needsBookingRows ?? true;
  if (bookingCount > 0) {
    if (needsBookingRows) {
      const { data: bookings, error: bookingErr } = await client
        .from("bookings")
        .select("id, status, series_id")
        .eq("customer_id", customerId);
      if (bookingErr) throw bookingErr;
      bookingRows = bookings ?? [];
      bookingIds = bookingRows.map((b) => b.id);
    } else {
      const { data: idRows, error: idErr } = await client
        .from("bookings")
        .select("id")
        .eq("customer_id", customerId);
      if (idErr) throw idErr;
      bookingIds = (idRows ?? []).map((b) => b.id);
    }

    const chunkSize = 100;
    for (let i = 0; i < bookingIds.length; i += chunkSize) {
      const chunk = bookingIds.slice(i, i + chunkSize);
      const { data: payments, error: payErr } = await client
        .from("payments")
        .select("id, status")
        .in("booking_id", chunk);
      if (payErr) throw payErr;
      paymentCount += (payments ?? []).length;
      if (needsBookingRows) {
        paidPaymentCount += (payments ?? []).filter((p) => p.status === PAID_PAYMENT_STATUS).length;
      }
    }
  }

  const locks = await countEq("booking_locks", "customer_id", customerId);
  const customerAudit = await countEq("customer_operational_audit", "customer_id", customerId);

  return {
    bookingCount,
    paymentCount,
    paidPaymentCount,
    recurringCount: recurringCount ?? 0,
    bookingLocks: locks,
    customerOperationalAudit: customerAudit,
    bookingIds,
    bookingRows,
  };
}

/**
 * Audit-fast counts: skips booking row fetch unless weak-mock paid safety check is required.
 * @param {import('@supabase/supabase-js').SupabaseClient} client
 * @param {string} customerId
 * @param {{ classification: import('./mock-customer-patterns.mjs').MockCustomerClassification }} input
 */
export async function countCustomerRelatedRowsForAudit(client, customerId, input) {
  const needsBookingRows =
    input.classification.mock && !input.classification.strong;
  return countCustomerRelatedRows(client, customerId, { needsBookingRows });
}

/**
 * Paid bookings that are not clearly test/E2E — block weak mock purge.
 * @param {ReturnType<typeof countCustomerRelatedRows> extends Promise<infer T> ? T : never} related
 * @param {{ email: string; companyName: string | null; classification: import('./mock-customer-patterns.mjs').MockCustomerClassification }} row
 */
export function countPaidProductionBookings(related, row) {
  if (row.classification.strong) return 0;
  if (related.paidPaymentCount === 0) return 0;
  if (isStrongMockCustomerSignal({ email: row.email, companyName: row.companyName })) {
    return 0;
  }
  if (isE2eCompanyName(row.companyName ?? "")) return 0;
  return related.paidPaymentCount;
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} client
 * @param {string} email
 */
export async function countNotificationsForRecipient(client, email) {
  if (!email || email.includes("(no auth")) return 0;
  const { count, error } = await client
    .from("notification_outbox")
    .select("id", { count: "exact", head: true })
    .eq("recipient", email);
  if (error) throw error;
  return count ?? 0;
}

/**
 * @param {ReturnType<typeof loadCustomerCandidates> extends Promise<infer R> ? R[number] : never} row
 * @param {Awaited<ReturnType<typeof countCustomerRelatedRows>>} related
 * @param {number} notificationCount
 */
export function enrichCustomerAuditRow(row, related, notificationCount) {
  if (!row.customerId) {
    return {
      ...row,
      bookingCount: 0,
      paymentCount: 0,
      recurringCount: 0,
      notificationCount: 0,
      paidProductionBookings: 0,
      customerAuditCount: 0,
      decision: "KEEP",
      match: row.classification.reasons.join(",") || "orphan",
    };
  }

  const paidProductionBookings = countPaidProductionBookings(related, row);
  const decision = resolveMockCustomerDecision(row.classification, {
    paidProductionBookings,
    customerAuditCount: related.customerOperationalAudit,
  }, row.alreadyPurged);

  return {
    ...row,
    bookingCount: related.bookingCount,
    paymentCount: related.paymentCount,
    recurringCount: related.recurringCount,
    notificationCount,
    paidProductionBookings,
    customerAuditCount: related.customerOperationalAudit,
    bookingLocks: related.bookingLocks,
    decision,
    match: row.classification.reasons.join(",") || "-",
    related,
  };
}

/**
 * @param {Awaited<ReturnType<typeof enrichCustomerAuditRow>>} row
 */
export function assertCustomerSafeToPurge(row) {
  if (row.decision !== "DELETE") {
    throw new Error(`Refusing purge for ${row.email}: decision=${row.decision}`);
  }
  if (PROTECTED_CUSTOMER_EMAILS.has(String(row.email).toLowerCase().trim())) {
    throw new Error(`Refusing purge for protected email ${row.email}`);
  }
  if (row.paidProductionBookings > 0 && !row.classification.strong) {
    throw new Error(
      `Refusing purge for ${row.email}: ${row.paidProductionBookings} paid production booking(s)`,
    );
  }
}

/**
 * @param {string[]} bookingIds
 * @param {Awaited<ReturnType<typeof countCustomerRelatedRows>>["bookingRows"]} bookingRows
 * @param {import('./mock-customer-patterns.mjs').MockCustomerClassification} classification
 */
export function selectBookingsToDelete(bookingIds, bookingRows, classification) {
  if (classification.strong) return bookingIds;
  const deletable = new Set();
  for (const booking of bookingRows) {
    if (["draft", "cancelled", "payment_failed"].includes(booking.status)) {
      deletable.add(booking.id);
    }
  }
  return bookingIds.filter((id) => deletable.has(id));
}
