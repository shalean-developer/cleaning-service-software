import { describe, expect, it } from "vitest";
import {
  buildInviteRowsFromLinkingReport,
  buildPhoneDerivedLoginEmailSpec,
  classifyInviteEmail,
} from "./prepareCleanerAuthInvitesLib";

describe("prepareCleanerAuthInvitesLib", () => {
  it("flags legacy placeholder email and uses phone login", () => {
    const result = classifyInviteEmail(
      "27680284159@cleaner.shalean.com",
      "+27680284159",
    );
    expect(result.emailKind).toBe("placeholder_email");
    expect(result.temporaryEmailIfNeeded).toBe("27680284159@cleaner.shalean.com");
    expect(result.adminLoginEmail).toBe("0680284159@shalean.co.za");
  });

  it("uses real personal email when present", () => {
    const result = classifyInviteEmail("cleaner@example.com", "+27792022648");
    expect(result.emailKind).toBe("real_email");
    expect(result.adminLoginEmail).toBe("cleaner@example.com");
  });

  it("builds spec phone email without plus", () => {
    expect(buildPhoneDerivedLoginEmailSpec("+27680284159")).toBe("27680284159@shalean.co.za");
  });

  it("extracts only needs_auth_invite rows from linking report", () => {
    const { rows, summary } = buildInviteRowsFromLinkingReport([
      {
        row_number: "2",
        full_name: "A",
        csv_email: "a@cleaner.shalean.com",
        phone_e164: "+27680284159",
        linkage_status: "needs_auth_invite",
      },
      {
        row_number: "3",
        full_name: "B",
        csv_email: "b@cleaner.shalean.com",
        phone_e164: "+27845559202",
        linkage_status: "already_imported",
      },
    ]);
    expect(summary.totalNeedsInvite).toBe(1);
    expect(rows[0]?.fullName).toBe("A");
    expect(rows[0]?.status).toBe("pending_invite");
  });
});
