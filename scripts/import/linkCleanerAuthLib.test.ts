import { describe, expect, it } from "vitest";
import {
  analyzeCleanerAuthLink,
  summarizeAuthLinking,
  type AuthIndex,
  type DbSnapshot,
} from "./linkCleanerAuthLib";
import type { NormalizedCleanerImportRow } from "./importCleanersLib";

function emptySnapshot(overrides: Partial<DbSnapshot> = {}): DbSnapshot {
  return {
    auth: { byId: new Map(), byEmail: new Map() },
    profiles: new Map(),
    cleanersByPhone: new Map(),
    cleanersByProfileId: new Map(),
    ...overrides,
  };
}

function baseRow(overrides: Partial<NormalizedCleanerImportRow> = {}): NormalizedCleanerImportRow {
  return {
    rowNumber: 2,
    legacyId: "legacy-1",
    fullName: "Test Cleaner",
    email: "0792022648@cleaner.shalean.com",
    phoneE164: "+27792022648",
    authUserId: "auth-uuid-1",
    averageRating: null,
    onboardingCompletedAt: null,
    serviceAreaSlugs: [],
    capabilities: ["regular-cleaning"],
    availabilityWindows: [],
    csvIsActive: true,
    ...overrides,
  };
}

describe("linkCleanerAuthLib", () => {
  it("marks row as needs_auth_invite when no auth match", () => {
    const result = analyzeCleanerAuthLink(baseRow(), emptySnapshot());
    expect(result.linkageStatus).toBe("needs_auth_invite");
    expect(result.currentProfileId).toBeNull();
    expect(result.importBlocked).toBe(true);
  });

  it("marks matched_ready when auth exists by phone-derived email", () => {
    const profileId = "auth-uuid-2";
    const authEmail = "0792022648@shalean.co.za";
    const auth: AuthIndex = {
      byId: new Map([[profileId, { id: profileId, email: authEmail }]]),
      byEmail: new Map([[authEmail, { id: profileId, email: authEmail }]]),
    };
    const result = analyzeCleanerAuthLink(
      baseRow({ authUserId: null, email: "0792022648@cleaner.shalean.com" }),
      emptySnapshot({ auth }),
    );
    expect(result.linkageStatus).toBe("matched_ready");
    expect(result.currentProfileId).toBe(profileId);
    expect(result.importBlocked).toBe(false);
  });

  it("marks duplicate_conflict when profile is customer", () => {
    const profileId = "auth-uuid-3";
    const authEmail = "0792022648@shalean.co.za";
    const auth: AuthIndex = {
      byId: new Map([[profileId, { id: profileId, email: authEmail }]]),
      byEmail: new Map([[authEmail, { id: profileId, email: authEmail }]]),
    };
    const profiles = new Map([
      [profileId, { id: profileId, role: "customer" as const, full_name: "Customer" }],
    ]);
    const result = analyzeCleanerAuthLink(
      baseRow({ authUserId: profileId }),
      emptySnapshot({ auth, profiles }),
    );
    expect(result.linkageStatus).toBe("duplicate_conflict");
    expect(result.importBlocked).toBe(true);
  });

  it("marks already_imported when cleaner exists by phone", () => {
    const snapshot = emptySnapshot({
      cleanersByPhone: new Map([
        [
          "+27792022648",
          { id: "cleaner-1", profile_id: "profile-1", phone: "+27792022648" },
        ],
      ]),
    });
    const result = analyzeCleanerAuthLink(baseRow(), snapshot);
    expect(result.linkageStatus).toBe("already_imported");
    expect(result.currentProfileId).toBe("profile-1");
  });

  it("summarizes import blocked when invites needed", () => {
    const results = [
      analyzeCleanerAuthLink(baseRow(), emptySnapshot()),
      analyzeCleanerAuthLink(baseRow({ rowNumber: 3, phoneE164: "+27845559202" }), emptySnapshot()),
    ];
    const summary = summarizeAuthLinking(results);
    expect(summary.needsAuthInvite).toBe(2);
    expect(summary.importBlocked).toBe(true);
  });
});
