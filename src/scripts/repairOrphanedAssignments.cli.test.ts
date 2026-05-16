import { describe, expect, it } from "vitest";
import { runRepairOrphanedAssignments } from "./repairOrphanedAssignments";

const isCli = process.env.ASSIGNMENT_REPAIR_CLI === "1";

describe.runIf(isCli)("repair orphaned assignments CLI", () => {
  it(
    "runs repair script entrypoint",
    async () => {
      const code = await runRepairOrphanedAssignments({
        dryRun: process.env.ASSIGNMENT_REPAIR_DRY_RUN !== "0",
      });
      expect(code).toBeLessThanOrEqual(1);
    },
    120_000,
  );
});
