import { describe, expect, it } from "vitest";
import { isAdminAssistedBookingMetadata, readAdminAssistMetadata } from "./adminAssistMetadata";

describe("adminAssistMetadata", () => {
  it("detects admin wizard draft metadata", () => {
    const metadata = {
      adminAssist: {
        source: "admin_wizard",
        phase: "draft_only",
        createdByProfileId: "admin-1",
      },
    };
    expect(isAdminAssistedBookingMetadata(metadata)).toBe(true);
    expect(readAdminAssistMetadata(metadata)?.source).toBe("admin_wizard");
  });

  it("returns false for unrelated metadata", () => {
    expect(isAdminAssistedBookingMetadata({ suburb: "Sea Point" })).toBe(false);
  });
});
