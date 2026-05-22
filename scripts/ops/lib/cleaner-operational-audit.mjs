/**
 * Shared cleaner operational audit + summary (Phase 1.5).
 */

export function resolveOperationalState(row, now = new Date()) {
  if (row.deleted_at != null) return "archived";
  if (row.suspended_at) {
    const at = new Date(row.suspended_at);
    if (!Number.isNaN(at.getTime()) && at.getTime() <= now.getTime()) {
      return "suspended";
    }
  }
  if (row.onboarding_completed_at == null) return "onboarding";
  if (!row.active) return "inactive";
  return "active";
}

/** Matches app dispatch pool: operational active + caps + availability configured. */
export function isAppDispatchReady(row, caps, avail, areas, now = new Date()) {
  return (
    resolveOperationalState(row, now) === "active" &&
    caps > 0 &&
    avail > 0 &&
    areas > 0
  );
}

/** Would evaluateOperationalDispatchGate allow (lifecycle only). */
export function isLifecycleDispatchEligible(row, now = new Date()) {
  return resolveOperationalState(row, now) === "active";
}

function emptyAffectedCounts() {
  return {
    openOffersCancelled: 0,
    activeBookingsFound: 0,
    pendingEarningsFound: 0,
  };
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} client
 */
export async function loadCleanerOperationalAuditContext(client) {
  const { data: cleaners, error } = await client
    .from("cleaners")
    .select(
      "id, profile_id, phone, active, suspended_at, deleted_at, onboarding_completed_at, suspension_ends_at, lifecycle_reason, created_at",
    );

  if (error) throw new Error(error.message);

  const rows = cleaners ?? [];
  if (rows.length === 0) {
    return {
      rows: [],
      profileById: new Map(),
      emailByProfileId: new Map(),
      capCount: new Map(),
      availCount: new Map(),
      areaCount: new Map(),
      assignmentHistory: new Map(),
    };
  }

  const ids = rows.map((r) => r.id);
  const profileIds = [...new Set(rows.map((r) => r.profile_id))];

  const [capsRes, availRes, areasRes, profilesRes, offersRes, bookingsRes] =
    await Promise.all([
      client.from("cleaner_service_capabilities").select("cleaner_id").in("cleaner_id", ids),
      client.from("cleaner_availability").select("cleaner_id").in("cleaner_id", ids),
      client.from("cleaner_service_areas").select("cleaner_id").in("cleaner_id", ids),
      client
        .from("profiles")
        .select("id, full_name, role")
        .in("id", profileIds),
      client.from("assignment_offers").select("cleaner_id").in("cleaner_id", ids),
      client
        .from("bookings")
        .select("cleaner_id")
        .in("cleaner_id", ids)
        .not("cleaner_id", "is", null),
    ]);

  for (const res of [capsRes, availRes, areasRes, profilesRes, offersRes, bookingsRes]) {
    if (res.error) throw new Error(res.error.message);
  }

  const countBy = (data, key) => {
    const map = new Map();
    for (const row of data ?? []) {
      const id = row[key];
      map.set(id, (map.get(id) ?? 0) + 1);
    }
    return map;
  };

  const capCount = countBy(capsRes.data, "cleaner_id");
  const availCount = countBy(availRes.data, "cleaner_id");
  const areaCount = countBy(areasRes.data, "cleaner_id");
  const profileById = new Map((profilesRes.data ?? []).map((p) => [p.id, p]));

  const assignmentHistory = new Map();
  for (const id of ids) assignmentHistory.set(id, false);
  for (const row of offersRes.data ?? []) {
    assignmentHistory.set(row.cleaner_id, true);
  }
  for (const row of bookingsRes.data ?? []) {
    if (row.cleaner_id) assignmentHistory.set(row.cleaner_id, true);
  }

  const emailByProfileId = new Map();
  for (const row of rows) {
    if (!row.phone) continue;
    const digits = String(row.phone).replace(/\D/g, "");
    if (digits) {
      emailByProfileId.set(
        row.profile_id,
        `${digits}@shalean.co.za`.toLowerCase(),
      );
    }
  }

  return {
    rows,
    profileById,
    emailByProfileId,
    capCount,
    availCount,
    areaCount,
    assignmentHistory,
  };
}

/**
 * @param {object} ctx
 * @param {Date} [now]
 */
export function auditCleanerOperationalStates(ctx, now = new Date()) {
  const findings = [];
  const info = [];

  const summary = {
    total: ctx.rows.length,
    operational: 0,
    onboarding: 0,
    inactive: 0,
    suspended: 0,
    archived: 0,
    dispatchEligible: 0,
    blockedFromDispatch: 0,
  };

  for (const row of ctx.rows) {
    const state = resolveOperationalState(row, now);
    const caps = ctx.capCount.get(row.id) ?? 0;
    const avail = ctx.availCount.get(row.id) ?? 0;
    const areas = ctx.areaCount.get(row.id) ?? 0;
    const profile = ctx.profileById.get(row.profile_id);
    const email =
      ctx.emailByProfileId.get(row.profile_id) ?? profile?.full_name ?? null;
    const hasHistory = ctx.assignmentHistory.get(row.id) === true;

    summary[state === "active" ? "operational" : state] =
      (summary[state === "active" ? "operational" : state] ?? 0) + 1;

    if (state === "active") summary.operational += 0; // counted above fix

    // Fix summary counting - use explicit keys
    if (state === "onboarding") summary.onboarding += 1;
    else if (state === "inactive") summary.inactive += 1;
    else if (state === "suspended") summary.suspended += 1;
    else if (state === "archived") summary.archived += 1;
    else if (state === "active") summary.operational += 1;

    const appReady = isAppDispatchReady(row, caps, avail, areas, now);
    if (appReady) summary.dispatchEligible += 1;
    else summary.blockedFromDispatch += 1;

    const base = {
      cleanerId: row.id,
      profileId: row.profile_id,
      email,
      operationalState: state,
      active: row.active,
      caps,
      avail,
      areas,
      hasAssignmentHistory: hasHistory,
      label: profile?.full_name?.trim() || row.id.slice(0, 8),
    };

    const push = (severity, code, hint) => {
      findings.push({ severity, code, hint, ...base });
    };

    // FAIL
    if (row.active && row.onboarding_completed_at == null) {
      push(
        "FAIL",
        "active_without_onboarding",
        "Set active=false or complete onboarding via admin complete-onboarding.",
      );
    }

    if (state === "onboarding" && row.deleted_at != null) {
      push(
        "FAIL",
        "onboarding_but_archived",
        "Archived row should not remain in onboarding; clear deleted_at via repair or archive properly.",
      );
    }

    if (
      row.suspended_at &&
      state === "active" &&
      isLifecycleDispatchEligible(row, now) &&
      isAppDispatchReady(row, caps, avail, areas, now)
    ) {
      const at = new Date(row.suspended_at);
      if (!Number.isNaN(at.getTime()) && at.getTime() > now.getTime()) {
        push(
          "FAIL",
          "suspended_but_dispatch_eligible",
          "Cleaner has future suspension but is dispatch-ready; verify suspension policy.",
        );
      }
    }

    if (state === "archived" && (row.active || isAppDispatchReady(row, caps, avail, areas, now))) {
      push(
        "FAIL",
        "archived_but_dispatch_visible",
        "Set active=false and ensure deleted_at is set; archived cleaners are excluded from pools.",
      );
    }

    if (state === "onboarding" && row.active && row.onboarding_completed_at == null) {
      push(
        "FAIL",
        "onboarding_visible_in_assignment_pool",
        "Onboarding cleaners cannot be active; set active=false until onboarding completes.",
      );
    }

    if (profile && profile.role !== "cleaner") {
      push(
        "FAIL",
        "profile_role_not_cleaner",
        `Profile role is ${profile.role}; repair auth/profile linkage.`,
      );
    }

    if (!profile) {
      push(
        "FAIL",
        "orphan_cleaner_profile",
        "Missing profiles row for profile_id; repair auth/profile linkage.",
      );
    }

    // WARN — active=true while suspended (dispatch leak risk in legacy checks)
    if (row.suspended_at && state === "suspended" && row.active) {
      push(
        "WARN",
        "suspended_but_dispatch_eligible",
        "Set active=false while suspended so dispatch pools cannot treat cleaner as active.",
      );
    }

    // WARN
    if (state === "active" && caps === 0) {
      push(
        "WARN",
        "active_without_capabilities",
        hasHistory
          ? "Add service capabilities or deactivate via admin."
          : "Add capabilities or run remediation to set active=false (no assignment history).",
      );
    }

    if (state === "active" && avail === 0) {
      push(
        "WARN",
        "active_without_availability",
        hasHistory
          ? "Add weekly availability or deactivate via admin."
          : "Add availability or run remediation to set active=false (no assignment history).",
      );
    }

    if (state === "active" && areas === 0) {
      push(
        "WARN",
        "active_without_service_areas",
        "Add at least one service area or deactivate until configured.",
      );
    }

    if (state === "onboarding" && (!row.phone?.trim() || caps === 0 || avail === 0)) {
      info.push({
        severity: "INFO",
        code: "onboarding_missing_profile_data",
        hint: "Complete phone, capabilities, availability, and service areas before onboarding completion.",
        ...base,
      });
    }

    if (state !== "active" && row.active && row.onboarding_completed_at != null) {
      push(
        "WARN",
        "active_flag_but_not_operational",
        `Operational state is ${state}; align active flag with lifecycle.`,
      );
    }

    if (state === "suspended" && row.active) {
      push(
        "WARN",
        "suspended_with_active_flag",
        "Consider setting active=false while suspended.",
      );
    }

    // INFO (non-blocking inventory)
    if (["inactive", "onboarding", "archived", "suspended"].includes(state)) {
      info.push({
        severity: "INFO",
        code: `${state}_cleaner`,
        hint: `Inventory: ${state} cleaner.`,
        ...base,
      });
    }
  }

  // Reset duplicate operational count from bug above - recalculate cleanly
  summary.operational = 0;
  summary.onboarding = 0;
  summary.inactive = 0;
  summary.suspended = 0;
  summary.archived = 0;
  for (const row of ctx.rows) {
    const state = resolveOperationalState(row, now);
    if (state === "active") summary.operational += 1;
    else if (state === "onboarding") summary.onboarding += 1;
    else if (state === "inactive") summary.inactive += 1;
    else if (state === "suspended") summary.suspended += 1;
    else if (state === "archived") summary.archived += 1;
  }

  summary.dispatchEligible = ctx.rows.filter((row) => {
    const state = resolveOperationalState(row, now);
    const caps = ctx.capCount.get(row.id) ?? 0;
    const avail = ctx.availCount.get(row.id) ?? 0;
    const areas = ctx.areaCount.get(row.id) ?? 0;
    return isAppDispatchReady(row, caps, avail, areas, now);
  }).length;
  summary.blockedFromDispatch = summary.total - summary.dispatchEligible;

  const failCount = findings.filter((f) => f.severity === "FAIL").length;
  const warnCount = findings.filter((f) => f.severity === "WARN").length;

  return { findings, info, summary, failCount, warnCount };
}

export function printAuditReport({ findings, info, summary, failCount, warnCount }) {
  console.log("Summary table:");
  console.log(`  total cleaners:        ${summary.total}`);
  console.log(`  operational (active):  ${summary.operational}`);
  console.log(`  onboarding:            ${summary.onboarding}`);
  console.log(`  inactive:              ${summary.inactive}`);
  console.log(`  suspended:             ${summary.suspended}`);
  console.log(`  archived:              ${summary.archived}`);
  console.log(`  dispatch eligible:     ${summary.dispatchEligible}`);
  console.log(`  blocked from dispatch: ${summary.blockedFromDispatch}`);
  console.log("");

  const issueFindings = findings.filter((f) => f.severity === "FAIL" || f.severity === "WARN");

  if (issueFindings.length === 0) {
    console.log(`PASS: ${summary.total} cleaner(s) — 0 FAIL, 0 WARN.`);
    return;
  }

  for (const f of issueFindings) {
    console.log(
      `${f.severity}: [${f.code}] ${f.label}`,
    );
    console.log(`  cleaner_id: ${f.cleanerId}`);
    console.log(`  profile_id: ${f.profileId}`);
    console.log(`  email: ${f.email ?? "—"}`);
    console.log(`  operationalState: ${f.operationalState}`);
    console.log(`  → ${f.hint}`);
    console.log("");
  }

  console.log(
    `Result: ${failCount} FAIL, ${warnCount} WARN (${summary.total} cleaners scanned)`,
  );
}

export function rowToLifecycleStateJson(row) {
  return {
    active: row.active,
    suspended_at: row.suspended_at,
    suspension_ends_at: row.suspension_ends_at ?? null,
    deleted_at: row.deleted_at,
    onboarding_completed_at: row.onboarding_completed_at,
    lifecycle_reason: row.lifecycle_reason ?? null,
  };
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} client
 */
export async function writeRemediationAudit(client, {
  cleanerId,
  beforeState,
  afterState,
  action,
  reason,
  metadata,
  idempotencyKey,
}) {
  const { data, error } = await client
    .from("cleaner_operational_audit")
    .insert({
      cleaner_id: cleanerId,
      admin_profile_id: null,
      action,
      outcome: "success",
      reason,
      before_state: beforeState,
      after_state: afterState,
      affected_counts: emptyAffectedCounts(),
      metadata: metadata ?? {},
      idempotency_key: idempotencyKey,
    })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505" && idempotencyKey) {
      return { idempotent: true, auditId: null };
    }
    throw new Error(error.message);
  }

  return { idempotent: false, auditId: data?.id ?? null };
}
