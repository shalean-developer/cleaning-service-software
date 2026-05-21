/**
 * Shared launch-readiness evaluation for ops audit (no DB I/O).
 */

export const REQUIRED_ENV_VARS = [
  "CRON_SECRET",
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "PAYSTACK_SECRET_KEY",
];

/**
 * @param {Record<string, string | undefined>} env
 * @returns {Array<{ code: string, level: 'FAIL'|'WARN', message: string }>}
 */
export function evaluateRequiredEnv(env) {
  const findings = [];
  for (const key of REQUIRED_ENV_VARS) {
    const value = env[key]?.trim();
    if (!value) {
      findings.push({
        code: `ENV_MISSING_${key}`,
        level: key === "CRON_SECRET" ? "FAIL" : "FAIL",
        message: `Missing required environment variable: ${key}`,
      });
    }
  }
  if (!env.CRON_SECRET?.trim()) {
    findings.push({
      code: "CRON_ROUTE_UNPROTECTED",
      level: "FAIL",
      message: "Cron route requires CRON_SECRET; generation endpoint would reject all calls.",
    });
  }
  return findings;
}

/**
 * @param {Array<{ code: string, severity: string }>} integrityIssues
 * @returns {Array<{ code: string, level: 'FAIL'|'WARN', message: string }>}
 */
export function evaluateIntegrityForLaunch(integrityIssues) {
  const findings = [];
  for (const issue of integrityIssues) {
    const level = issue.severity === "critical" ? "FAIL" : "WARN";
    findings.push({
      code: issue.code,
      level,
      message: issue.detail ?? issue.code,
    });
  }
  return findings;
}

/**
 * @param {Array<{ level: 'PASS'|'WARN'|'FAIL' }>} checks
 * @returns {'PASS'|'WARN'|'FAIL'}
 */
export function deriveLaunchReadinessStatus(checks) {
  if (checks.some((c) => c.level === "FAIL")) return "FAIL";
  if (checks.some((c) => c.level === "WARN")) return "WARN";
  return "PASS";
}

/**
 * @param {object} input
 * @param {boolean} input.tableBookingSeries
 * @param {boolean} input.tableRecurringGenerationRuns
 * @param {boolean} input.rlsPoliciesDocumented
 * @param {number} input.activeSeriesCount
 * @param {boolean} input.cronSecretConfigured
 */
export function evaluateInfrastructureChecks(input) {
  const checks = [];
  if (!input.tableBookingSeries) {
    checks.push({
      code: "TABLE_BOOKING_SERIES",
      level: "FAIL",
      message: "booking_series table is missing or unreadable.",
    });
  } else {
    checks.push({
      code: "TABLE_BOOKING_SERIES",
      level: "PASS",
      message: "booking_series table exists.",
    });
  }
  if (!input.tableRecurringGenerationRuns) {
    checks.push({
      code: "TABLE_RECURRING_GENERATION_RUNS",
      level: "FAIL",
      message: "recurring_generation_runs table is missing (cron run logging).",
    });
  } else {
    checks.push({
      code: "TABLE_RECURRING_GENERATION_RUNS",
      level: "PASS",
      message: "recurring_generation_runs table exists.",
    });
  }
  if (!input.rlsPoliciesDocumented) {
    checks.push({
      code: "RLS_BOOKING_SERIES",
      level: "WARN",
      message: "Could not confirm booking_series RLS policies in repo.",
    });
  } else {
    checks.push({
      code: "RLS_BOOKING_SERIES",
      level: "PASS",
      message: "booking_series RLS migration present in repo.",
    });
  }
  if (!input.cronSecretConfigured) {
    checks.push({
      code: "CRON_SECRET",
      level: "FAIL",
      message: "CRON_SECRET not configured.",
    });
  } else {
    checks.push({
      code: "CRON_SECRET",
      level: "PASS",
      message: "Cron route secret configured.",
    });
  }
  if (input.activeSeriesCount === 0 && input.tableBookingSeries) {
    checks.push({
      code: "QUIET_RECURRING_STATE",
      level: "PASS",
      message: "No active series — system configured, quiet state.",
    });
  }
  return checks;
}
