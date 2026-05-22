#!/usr/bin/env node
/**
 * Remediate legacy cleaner operational inconsistencies (Phase 1.5).
 *
 * Usage:
 *   npm run ops:remediate:cleaner-operational-states
 *   CONFIRM_REMEDIATE_CLEANER_STATES=yes npm run ops:remediate:cleaner-operational-states -- --apply
 */
import { createClient } from "@supabase/supabase-js";
import { loadEnvFiles, requireServiceRoleClient } from "../e2e/lib/env.mjs";
import {
  auditCleanerOperationalStates,
  loadCleanerOperationalAuditContext,
  printAuditReport,
  resolveOperationalState,
  rowToLifecycleStateJson,
  writeRemediationAudit,
} from "./lib/cleaner-operational-audit.mjs";

loadEnvFiles();
const client = requireServiceRoleClient(createClient);

const args = process.argv.slice(2);
const applyRequested = args.includes("--apply");
const confirmed = process.env.CONFIRM_REMEDIATE_CLEANER_STATES === "yes";

function usage() {
  console.log(`Cleaner operational remediation

Usage:
  npm run ops:remediate:cleaner-operational-states
  CONFIRM_REMEDIATE_CLEANER_STATES=yes npm run ops:remediate:cleaner-operational-states -- --apply

Flags:
  --apply    Apply safe remediations (requires confirm env)
  --help     Show this message`);
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} client
 * @param {object} row
 * @param {object} patch
 */
async function updateCleanerRow(client, row, patch) {
  const { data, error } = await client
    .from("cleaners")
    .update(patch)
    .eq("id", row.id)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data;
}

async function planRemediations(ctx, now) {
  const plans = [];

  for (const row of ctx.rows) {
    const state = resolveOperationalState(row, now);
    const caps = ctx.capCount.get(row.id) ?? 0;
    const avail = ctx.availCount.get(row.id) ?? 0;
    const areas = ctx.areaCount.get(row.id) ?? 0;
    const hasHistory = ctx.assignmentHistory.get(row.id) === true;
    const label =
      ctx.profileById.get(row.profile_id)?.full_name?.trim() || row.id.slice(0, 8);

    // Rule 1: active without onboarding → active=false
    if (row.active && row.onboarding_completed_at == null) {
      plans.push({
        cleanerId: row.id,
        label,
        code: "active_without_onboarding",
        patch: {
          active: false,
          lifecycle_reason: "ops_phase_1_5_remediate_active_without_onboarding",
        },
        idempotencyKey: `ops-15-active-without-onboarding-${row.id}`,
        reason: "Phase 1.5: active=true with incomplete onboarding corrected to active=false.",
      });
      continue;
    }

    // Rule 4/5: archived but still active
    if (state === "archived" && row.active) {
      plans.push({
        cleanerId: row.id,
        label,
        code: "archived_but_dispatch_visible",
        patch: {
          active: false,
          lifecycle_reason: "ops_phase_1_5_remediate_archived_active_flag",
        },
        idempotencyKey: `ops-15-archived-active-${row.id}`,
        reason: "Phase 1.5: archived cleaner active flag cleared.",
      });
    }

    // Rule 5: onboarding + active flag
    if (state === "onboarding" && row.active) {
      plans.push({
        cleanerId: row.id,
        label,
        code: "onboarding_visible_in_assignment_pool",
        patch: {
          active: false,
          lifecycle_reason: "ops_phase_1_5_remediate_onboarding_active_flag",
        },
        idempotencyKey: `ops-15-onboarding-active-${row.id}`,
        reason: "Phase 1.5: onboarding cleaner active flag cleared.",
      });
    }

    // Suspended with active flag — safe deactivate for dispatch exclusion
    if (state === "suspended" && row.active) {
      plans.push({
        cleanerId: row.id,
        label,
        code: "suspended_with_active_flag",
        patch: {
          active: false,
          lifecycle_reason: "ops_phase_1_5_remediate_suspended_active_flag",
        },
        idempotencyKey: `ops-15-suspended-active-${row.id}`,
        reason: "Phase 1.5: suspended cleaner active flag cleared for dispatch safety.",
      });
    }

    // Rules 2 & 3: active operational but missing caps/avail — deactivate if no history
    if (state === "active") {
      const missingCaps = caps === 0;
      const missingAvail = avail === 0;
      if ((missingCaps || missingAvail) && !hasHistory) {
        plans.push({
          cleanerId: row.id,
          label,
          code: missingCaps
            ? "active_without_capabilities"
            : "active_without_availability",
          patch: {
            active: false,
            lifecycle_reason: "ops_phase_1_5_remediate_incomplete_profile_no_history",
          },
          idempotencyKey: `ops-15-incomplete-no-history-${row.id}`,
          reason:
            "Phase 1.5: active cleaner without full profile config and no assignment history — set inactive.",
        });
      }
    }

    // active flag but not operational (inactive state with active=true)
    if (state === "inactive" && row.active) {
      plans.push({
        cleanerId: row.id,
        label,
        code: "active_flag_but_not_operational",
        patch: {
          active: false,
          lifecycle_reason: "ops_phase_1_5_remediate_inactive_active_flag",
        },
        idempotencyKey: `ops-15-inactive-active-flag-${row.id}`,
        reason: "Phase 1.5: align active flag with inactive operational state.",
      });
    }
  }

  return plans;
}

async function main() {
  if (args.includes("--help") || args.includes("-h")) {
    usage();
    return;
  }

  if (applyRequested && !confirmed) {
    console.error(
      "Error: --apply requires CONFIRM_REMEDIATE_CLEANER_STATES=yes\n" +
        "Example:\n" +
        "  CONFIRM_REMEDIATE_CLEANER_STATES=yes npm run ops:remediate:cleaner-operational-states -- --apply",
    );
    process.exit(1);
  }

  const dryRun = !applyRequested || !confirmed;
  console.log(
    dryRun
      ? "Cleaner operational remediation (dry-run — no writes)\n"
      : "Cleaner operational remediation (apply mode)\n",
  );

  const ctx = await loadCleanerOperationalAuditContext(client);
  const before = auditCleanerOperationalStates(ctx);
  console.log("--- Before ---");
  printAuditReport(before);

  const plans = await planRemediations(ctx, new Date());

  if (plans.length === 0) {
    console.log("\nNo automatic remediations planned.");
    console.log(
      "Remaining WARN items may need manual profile setup (capabilities, availability, areas).",
    );
    return;
  }

  console.log(`\nPlanned remediations (${plans.length}):`);
  for (const plan of plans) {
    console.log(`  [${plan.code}] ${plan.label} (${plan.cleanerId})`);
    console.log(`    patch: ${JSON.stringify(plan.patch)}`);
  }

  if (dryRun) {
    console.log(
      "\nDry-run complete. Re-run with CONFIRM_REMEDIATE_CLEANER_STATES=yes and --apply to apply.",
    );
    return;
  }

  console.log("\nApplying remediations...");
  let applied = 0;
  let skipped = 0;

  for (const plan of plans) {
    const row = ctx.rows.find((r) => r.id === plan.cleanerId);
    if (!row) continue;

    const beforeState = rowToLifecycleStateJson(row);
    const updated = await updateCleanerRow(client, row, plan.patch);
    const afterState = rowToLifecycleStateJson(updated);

    const audit = await writeRemediationAudit(client, {
      cleanerId: plan.cleanerId,
      beforeState,
      afterState,
      action: "ops_remediation",
      reason: plan.reason,
      metadata: { code: plan.code, phase: "1.5" },
      idempotencyKey: plan.idempotencyKey,
    });

    if (audit.idempotent) {
      skipped += 1;
      console.log(`  SKIP (idempotent): ${plan.cleanerId} [${plan.code}]`);
    } else {
      applied += 1;
      console.log(`  OK: ${plan.label} [${plan.code}] active ${beforeState.active} → ${afterState.active}`);
    }

    Object.assign(row, updated);
  }

  console.log(`\nApplied: ${applied}, skipped (idempotent): ${skipped}`);

  const afterCtx = await loadCleanerOperationalAuditContext(client);
  const after = auditCleanerOperationalStates(afterCtx);
  console.log("\n--- After ---");
  printAuditReport(after);

  if (after.failCount > 0 || after.warnCount > 0) {
    console.log(
      "\nSome issues remain — complete profile setup (capabilities, availability, areas) or onboarding via admin.",
    );
    process.exit(after.failCount > 0 ? 1 : 2);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
