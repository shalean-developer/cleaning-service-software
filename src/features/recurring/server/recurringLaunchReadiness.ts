export const RECURRING_LAUNCH_REQUIRED_ENV = [
  "CRON_SECRET",
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "PAYSTACK_SECRET_KEY",
] as const;

export type LaunchCheckLevel = "PASS" | "WARN" | "FAIL";

export type LaunchCheck = {
  code: string;
  level: LaunchCheckLevel;
  message: string;
};

export function evaluateRequiredEnvForLaunch(
  env: Record<string, string | undefined>,
): LaunchCheck[] {
  const checks: LaunchCheck[] = [];
  for (const key of RECURRING_LAUNCH_REQUIRED_ENV) {
    if (!env[key]?.trim()) {
      checks.push({
        code: `ENV_MISSING_${key}`,
        level: "FAIL",
        message: `Missing required environment variable: ${key}`,
      });
    }
  }
  return checks;
}

export function deriveLaunchReadinessLevel(input: {
  hasCriticalAlerts: boolean;
  hasWarnings: boolean;
  missingRequiredEnv: boolean;
}): "green" | "amber" | "red" {
  if (input.missingRequiredEnv || input.hasCriticalAlerts) return "red";
  if (input.hasWarnings) return "amber";
  return "green";
}

export function deriveLaunchReadinessFromChecks(checks: LaunchCheck[]): "PASS" | "WARN" | "FAIL" {
  if (checks.some((c) => c.level === "FAIL")) return "FAIL";
  if (checks.some((c) => c.level === "WARN")) return "WARN";
  return "PASS";
}

export function cronRunAgeWarning(ageHours: number | null): LaunchCheck | null {
  if (ageHours == null) {
    return {
      code: "CRON_NEVER_RAN",
      level: "WARN",
      message: "No recurring generation run logged yet.",
    };
  }
  if (ageHours > 48) {
    return {
      code: "CRON_STALE",
      level: "WARN",
      message: `Last cron run was ${ageHours}h ago (>48h).`,
    };
  }
  return null;
}
