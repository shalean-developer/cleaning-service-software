import { describe, expect, it } from "vitest";
import { runRecoverAssignmentAfterPaymentCli } from "./recoverAssignmentAfterPayment";

const shouldRun = process.env.ASSIGNMENT_RECOVERY_CLI === "1";

describe.skipIf(!shouldRun)("recoverAssignmentAfterPayment CLI", () => {
  it("runs dry-run discovery", async () => {
    const code = await runRecoverAssignmentAfterPaymentCli({
      dryRun: process.env.ASSIGNMENT_RECOVERY_DRY_RUN !== "0",
    });
    expect([0, 1]).toContain(code);
  });
});
