import { describe, expect, it } from "vitest";
import {
  cronRunAgeWarning,
  deriveLaunchReadinessFromChecks,
  deriveLaunchReadinessLevel,
  evaluateRequiredEnvForLaunch,
} from "./recurringLaunchReadiness";

describe("recurringLaunchReadiness", () => {
  it("missing CRON_SECRET => FAIL", () => {
    const checks = evaluateRequiredEnvForLaunch({});
    expect(checks.some((c) => c.code === "ENV_MISSING_CRON_SECRET" && c.level === "FAIL")).toBe(
      true,
    );
    expect(deriveLaunchReadinessFromChecks(checks)).toBe("FAIL");
  });

  it("deriveLaunchReadinessLevel red when critical or missing env", () => {
    expect(
      deriveLaunchReadinessLevel({
        hasCriticalAlerts: true,
        hasWarnings: false,
        missingRequiredEnv: false,
      }),
    ).toBe("red");
    expect(
      deriveLaunchReadinessLevel({
        hasCriticalAlerts: false,
        hasWarnings: false,
        missingRequiredEnv: true,
      }),
    ).toBe("red");
  });

  it("quiet configured state can be green", () => {
    expect(
      deriveLaunchReadinessLevel({
        hasCriticalAlerts: false,
        hasWarnings: false,
        missingRequiredEnv: false,
      }),
    ).toBe("green");
  });

  it("cronRunAgeWarning when never ran", () => {
    expect(cronRunAgeWarning(null)?.code).toBe("CRON_NEVER_RAN");
  });

  it("cronRunAgeWarning when stale", () => {
    expect(cronRunAgeWarning(72)?.level).toBe("WARN");
  });
});
