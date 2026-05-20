/**
 * Shared customer domain audit logic for reconcile + repair ops scripts.
 */

export const ACTIONS = ["KEEP", "REPAIR", "REVIEW", "UNSAFE"];

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} client
 */
export async function listAuthEmailsByProfileId(client) {
  /** @type {Map<string, string>} */
  const byId = new Map();
  let page = 1;
  for (;;) {
    const { data, error } = await client.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    for (const user of data.users ?? []) {
      if (user.id && user.email) byId.set(user.id, user.email);
    }
    if ((data.users ?? []).length < 200) break;
    page += 1;
  }
  return byId;
}

/**
 * Resolve auth emails only for known profile IDs (faster than full listUsers scan).
 * @param {import('@supabase/supabase-js').SupabaseClient} client
 * @param {readonly string[]} profileIds
 */
export async function listAuthEmailsForProfileIds(client, profileIds) {
  /** @type {Map<string, string>} */
  const byId = new Map();
  const unique = [...new Set(profileIds.filter(Boolean))];
  const concurrency = 12;

  for (let i = 0; i < unique.length; i += concurrency) {
    const chunk = unique.slice(i, i + concurrency);
    await Promise.all(
      chunk.map(async (profileId) => {
        const { data, error } = await client.auth.admin.getUserById(profileId);
        if (error || !data.user?.email) return;
        byId.set(profileId, data.user.email);
      }),
    );
  }

  return byId;
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} client
 */
export async function loadDomainSnapshot(client) {
  const [
    { data: profiles, error: profileErr },
    { data: customers, error: customerErr },
    { data: cleaners, error: cleanerErr },
  ] = await Promise.all([
    client.from("profiles").select("id, role, full_name"),
    client.from("customers").select("id, profile_id, company_name, created_at"),
    client.from("cleaners").select("id, profile_id"),
  ]);

  if (profileErr) throw profileErr;
  if (customerErr) throw customerErr;
  if (cleanerErr) throw cleanerErr;

  const authEmails = await listAuthEmailsByProfileId(client);

  /** @type {Map<string, { id: string; profile_id: string; company_name: string | null; created_at: string }>} */
  const customerByProfile = new Map();
  /** @type {Map<string, number>} */
  const customerCountByProfile = new Map();

  for (const row of customers ?? []) {
    customerByProfile.set(row.profile_id, row);
    customerCountByProfile.set(
      row.profile_id,
      (customerCountByProfile.get(row.profile_id) ?? 0) + 1,
    );
  }

  /** @type {Map<string, { id: string; profile_id: string }>} */
  const cleanerByProfile = new Map();
  for (const row of cleaners ?? []) {
    cleanerByProfile.set(row.profile_id, row);
  }

  /** @type {Map<string, number>} */
  const bookingCountByCustomerId = new Map();
  const customerIds = (customers ?? []).map((c) => c.id);
  if (customerIds.length > 0) {
    const chunkSize = 100;
    for (let i = 0; i < customerIds.length; i += chunkSize) {
      const chunk = customerIds.slice(i, i + chunkSize);
      const { data: bookingRows, error: bookingErr } = await client
        .from("bookings")
        .select("customer_id")
        .in("customer_id", chunk);
      if (bookingErr) throw bookingErr;
      for (const row of bookingRows ?? []) {
        bookingCountByCustomerId.set(
          row.customer_id,
          (bookingCountByCustomerId.get(row.customer_id) ?? 0) + 1,
        );
      }
    }
  }

  return {
    profiles: profiles ?? [],
    customerByProfile,
    customerCountByProfile,
    cleanerByProfile,
    authEmails,
    bookingCountByCustomerId,
  };
}

/**
 * @param {{
 *   profileId: string;
 *   email: string;
 *   role: string;
 *   fullName: string | null;
 *   customer: { id: string; profile_id: string; company_name: string | null } | null;
 *   cleaner: { id: string; profile_id: string } | null;
 *   customerDuplicateCount: number;
 *   bookingCount: number;
 * }} ctx
 */
export function classifyProfile(ctx) {
  const issues = [];
  const { role, customer, cleaner, customerDuplicateCount, bookingCount } = ctx;

  if (customerDuplicateCount > 1) {
    issues.push({
      code: "DUPLICATE_CUSTOMER_PROFILE_MAPPING",
      detail: `${customerDuplicateCount} customers rows share profile_id`,
    });
  }

  if (role === "customer" && !customer) {
    issues.push({
      code: "CUSTOMER_PROFILE_MISSING_DOMAIN_ROW",
      detail: "profiles.role=customer but no customers row",
    });
  }

  if (customer && role !== "customer") {
    issues.push({
      code: "CUSTOMER_ROW_ROLE_MISMATCH",
      detail: `customers row exists while profiles.role=${role}`,
    });
  }

  if (customer && cleaner) {
    issues.push({
      code: "DUAL_DOMAIN_PROFILE",
      detail: "profile has both customers and cleaners rows",
    });
  }

  if (issues.length === 0) {
    return {
      action: "KEEP",
      issueCodes: [],
      repairHint: null,
    };
  }

  const codes = issues.map((i) => i.code);

  if (codes.includes("DUPLICATE_CUSTOMER_PROFILE_MAPPING")) {
    return {
      action: "UNSAFE",
      issueCodes: codes,
      repairHint: "Manual DBA review required — unique constraint violation on customers.profile_id",
    };
  }

  if (codes.includes("CUSTOMER_PROFILE_MISSING_DOMAIN_ROW")) {
    return {
      action: "REPAIR",
      issueCodes: codes,
      repairHint:
        "rpc ensure_customer_provisioned(profile_id) or npm run ops:repair:customer-domain",
    };
  }

  if (bookingCount > 0 && codes.includes("CUSTOMER_ROW_ROLE_MISMATCH")) {
    return {
      action: "UNSAFE",
      issueCodes: codes,
      repairHint:
        "Bookings reference customers.id — do not delete row without migration plan; reconcile role or archive",
    };
  }

  if (bookingCount > 0 && codes.includes("DUAL_DOMAIN_PROFILE")) {
    return {
      action: "UNSAFE",
      issueCodes: codes,
      repairHint:
        "Bookings exist on customer row — resolve dual-domain manually before any row deletion",
    };
  }

  return {
    action: "REVIEW",
    issueCodes: codes,
    repairHint:
      "Ops review: stray domain row or dual-domain without bookings — see docs/operations/customer-domain-reconciliation-hardening-plan.md",
  };
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} client
 */
export async function runCustomerDomainAudit(client) {
  const snapshot = await loadDomainSnapshot(client);
  const findings = [];

  for (const profile of snapshot.profiles) {
    const customer = snapshot.customerByProfile.get(profile.id) ?? null;
    const cleaner = snapshot.cleanerByProfile.get(profile.id) ?? null;
    const customerDuplicateCount = snapshot.customerCountByProfile.get(profile.id) ?? 0;
    const bookingCount = customer
      ? (snapshot.bookingCountByCustomerId.get(customer.id) ?? 0)
      : 0;

    const { action, issueCodes, repairHint } = classifyProfile({
      profileId: profile.id,
      email: snapshot.authEmails.get(profile.id) ?? "(no auth email)",
      role: profile.role,
      fullName: profile.full_name,
      customer,
      cleaner,
      customerDuplicateCount,
      bookingCount,
    });

    if (!ACTIONS.includes(action)) {
      throw new Error(`Invalid action ${action} for profile ${profile.id}`);
    }

    findings.push({
      action,
      profileId: profile.id,
      email: snapshot.authEmails.get(profile.id) ?? "(no auth email)",
      role: profile.role,
      fullName: profile.full_name,
      customerId: customer?.id ?? null,
      cleanerId: cleaner?.id ?? null,
      bookingCount,
      customerDuplicateCount,
      issueCodes,
      repairHint,
    });
  }

  const orphanCustomerRows = [];
  for (const [profileId, customer] of snapshot.customerByProfile) {
    const profile = snapshot.profiles.find((p) => p.id === profileId);
    if (!profile) {
      orphanCustomerRows.push({
        action: "UNSAFE",
        profileId,
        customerId: customer.id,
        issueCodes: ["CUSTOMER_ROW_ORPHAN_PROFILE"],
        repairHint: "customers.profile_id has no profiles row — investigate FK integrity",
      });
    }
  }

  const summary = {
    totalProfiles: findings.length,
    keep: findings.filter((f) => f.action === "KEEP").length,
    repair: findings.filter((f) => f.action === "REPAIR").length,
    review: findings.filter((f) => f.action === "REVIEW").length,
    unsafe: findings.filter((f) => f.action === "UNSAFE").length,
    orphanCustomerRows: orphanCustomerRows.length,
  };

  const sorted = [...findings].sort((a, b) => {
    const order = { UNSAFE: 0, REVIEW: 1, REPAIR: 2, KEEP: 3 };
    const byAction = (order[a.action] ?? 9) - (order[b.action] ?? 9);
    if (byAction !== 0) return byAction;
    return a.email.localeCompare(b.email);
  });

  return { findings: sorted, orphanCustomerRows, summary };
}

/**
 * @param {{ keep: number; repair: number; review: number; unsafe: number; orphanCustomerRows?: number }} summary
 * @param {string} [label]
 */
export function printAuditSummary(summary, label = "Audit summary") {
  console.log(`\n${label}:`);
  console.log(`  KEEP:   ${summary.keep}`);
  console.log(`  REPAIR: ${summary.repair}`);
  console.log(`  REVIEW: ${summary.review}`);
  console.log(`  UNSAFE: ${summary.unsafe}`);
  if (summary.orphanCustomerRows > 0) {
    console.log(`  Orphan customers rows: ${summary.orphanCustomerRows}`);
  }
}

/**
 * Stray customers rows on non-customer profiles (REVIEW cleanup planning only).
 * @param {Awaited<ReturnType<typeof runCustomerDomainAudit>>['findings']} findings
 */
export function buildReviewCleanupPlan(findings) {
  return findings
    .filter(
      (f) =>
        f.action === "REVIEW" &&
        f.issueCodes.includes("CUSTOMER_ROW_ROLE_MISMATCH") &&
        f.customerId,
    )
    .map((f) => ({
      profileId: f.profileId,
      email: f.email,
      role: f.role,
      customerId: f.customerId,
      bookingCount: f.bookingCount,
      deleteLaterClassification:
        f.bookingCount > 0 ? "BLOCKED_HAS_BOOKINGS" : "SAFE_TO_DELETE_LATER",
    }));
}

/**
 * Deletable stray customers rows (role != customer, zero bookings).
 * @param {Awaited<ReturnType<typeof runCustomerDomainAudit>>['findings']} findings
 */
export function buildStrayCustomerDeletionTargets(findings) {
  return buildReviewCleanupPlan(findings).filter(
    (row) => row.deleteLaterClassification === "SAFE_TO_DELETE_LATER",
  );
}

/**
 * Stray rows blocked by bookings — must not be deleted by cleanup script.
 * @param {Awaited<ReturnType<typeof runCustomerDomainAudit>>['findings']} findings
 */
export function buildBlockedStrayCustomerRows(findings) {
  return buildReviewCleanupPlan(findings).filter(
    (row) => row.deleteLaterClassification === "BLOCKED_HAS_BOOKINGS",
  );
}

/**
 * @param {ReturnType<typeof buildStrayCustomerDeletionTargets>} targets
 */
export function printPlannedDeletions(targets) {
  if (targets.length === 0) {
    console.log("\nPlanned deletions: none (no safe stray customers rows).");
    return;
  }

  console.log(`\nPlanned deletions (${targets.length} customers row(s)):`);
  for (const row of targets) {
    console.log(`  email=${row.email}`);
    console.log(`    profile_id=${row.profileId}`);
    console.log(`    role=${row.role}`);
    console.log(`    customer_id=${row.customerId}`);
    console.log(`    booking_count=${row.bookingCount}`);
  }
}

/**
 * @param {ReturnType<typeof buildReviewCleanupPlan>} plan
 */
export function printReviewCleanupPlan(plan) {
  if (plan.length === 0) {
    console.log("\nREVIEW cleanup plan: no stray customer rows on non-customer profiles.");
    return;
  }

  console.log("\nREVIEW cleanup plan (planning only — no deletes):");
  console.log(
    "  Stray customers rows where profiles.role != customer\n",
  );
  for (const row of plan) {
    console.log(`  ${row.email}  role=${row.role}`);
    console.log(`    customer_id=${row.customerId}  bookings=${row.bookingCount}`);
    console.log(`    classification: ${row.deleteLaterClassification}`);
  }
}
