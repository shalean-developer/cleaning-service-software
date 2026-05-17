import { describe, expect, it } from "vitest";
import { mapAdminOperationalOutcome } from "./mapAdminOperationalOutcome";

describe("mapAdminOperationalOutcome", () => {
  it("maps success-like statuses", () => {
    expect(mapAdminOperationalOutcome("recovered")).toBe("success");
    expect(mapAdminOperationalOutcome("offered")).toBe("success");
    expect(mapAdminOperationalOutcome("replaced")).toBe("success");
  });

  it("maps idempotent statuses", () => {
    expect(mapAdminOperationalOutcome("already_recovered")).toBe("idempotent");
    expect(mapAdminOperationalOutcome("already_offered", { idempotent: true })).toBe(
      "idempotent",
    );
  });

  it("maps rejected statuses", () => {
    expect(mapAdminOperationalOutcome("not_eligible")).toBe("rejected");
    expect(mapAdminOperationalOutcome("still_confirmed")).toBe("rejected");
  });

  it("maps errors to failed", () => {
    expect(mapAdminOperationalOutcome("error")).toBe("failed");
    expect(mapAdminOperationalOutcome("unknown")).toBe("failed");
  });
});
