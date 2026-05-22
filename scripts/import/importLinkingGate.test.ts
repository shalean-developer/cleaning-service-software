import { describe, expect, it } from "vitest";
import { assertImportAllowed, type LinkingReportRow } from "./importLinkingGate";

function link(
  overrides: Partial<LinkingReportRow> & Pick<LinkingReportRow, "rowNumber" | "linkageStatus">,
): LinkingReportRow {
  return {
    currentProfileId: null,
    fullName: "Test",
    importBlocked: true,
    ...overrides,
  };
}

describe("importLinkingGate", () => {
  it("blocks import when a row needs auth invite", () => {
    const map = new Map<number, LinkingReportRow>([
      [
        2,
        link({
          rowNumber: 2,
          linkageStatus: "needs_auth_invite",
          currentProfileId: null,
        }),
      ],
    ]);
    const result = assertImportAllowed(map, []);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.blocked.length).toBeGreaterThan(0);
  });

  it("allows import when all rows are matched_ready with profile_id", () => {
    const map = new Map<number, LinkingReportRow>([
      [
        2,
        link({
          rowNumber: 2,
          linkageStatus: "matched_ready",
          currentProfileId: "uuid-1",
          importBlocked: false,
        }),
      ],
      [
        3,
        link({
          rowNumber: 3,
          linkageStatus: "already_imported",
          currentProfileId: "uuid-2",
          importBlocked: false,
        }),
      ],
    ]);
    const result = assertImportAllowed(map, [2]);
    expect(result.ok).toBe(true);
  });
});
