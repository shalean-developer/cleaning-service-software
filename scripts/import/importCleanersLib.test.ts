import { describe, expect, it } from "vitest";
import {
  buildImportPlan,
  normalizeCleanerRow,
  parseCsv,
  summarizePlan,
  type ExistingCleanerIndex,
} from "./importCleanersLib";

const SAMPLE_CSV = `id,full_name,email,phone,auth_user_id,status,rating,is_active,location,availability_start,availability_end,availability_weekdays,can_do_deep_cleaning,can_do_move_cleaning,joined_at
aaa-bbb-ccc,Test Cleaner,0792022648@cleaner.shalean.com,+27792022648,f77e9767-10bb-4b73-b529-2f6f4fdf3ce1,available,5,true,"Claremont, Sea Point",08:00:00,17:00:00,"[""mon"",""tue""]",true,false,2025-10-17 19:38:30+00
`;

describe("importCleanersLib", () => {
  it("parses CSV rows", () => {
    const rows = parseCsv(SAMPLE_CSV);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.full_name).toBe("Test Cleaner");
  });

  it("normalizes a valid row", () => {
    const rows = parseCsv(SAMPLE_CSV);
    const result = normalizeCleanerRow(rows[0]!, 2);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.phoneE164).toBe("+27792022648");
    expect(result.value.capabilities).toContain("regular-cleaning");
    expect(result.value.capabilities).toContain("deep-cleaning");
    expect(result.value.serviceAreaSlugs.length).toBeGreaterThan(0);
    expect(result.value.availabilityWindows).toHaveLength(2);
  });

  it("skips duplicate phone in CSV", () => {
    const csv = `${SAMPLE_CSV.trim()}\nbbb-ccc-ddl,Other,0792022648@cleaner.shalean.com,+27792022648,f77e9767-10bb-4b73-b529-2f6f4fdf3ce1,available,5,true,Claremont,08:00:00,17:00:00,"[""mon""]",false,false,2025-10-17 19:38:30+00\n`;
    const existing: ExistingCleanerIndex = { byPhone: new Map(), byProfileId: new Map() };
    const plan = buildImportPlan(parseCsv(csv), existing);
    const summary = summarizePlan(plan);
    expect(summary.duplicateCsv).toBe(1);
    expect(summary.inserted).toBe(1);
  });

  it("skips existing cleaner by phone without overwrite", () => {
    const rows = parseCsv(SAMPLE_CSV);
    const existing: ExistingCleanerIndex = {
      byPhone: new Map([
        ["+27792022648", { cleanerId: "existing-id", profileId: "profile-id" }],
      ]),
      byProfileId: new Map(),
    };
    const plan = buildImportPlan(rows, existing);
    expect(plan.plan[0]?.kind).toBe("skip");
    if (plan.plan[0]?.kind === "skip") {
      expect(plan.plan[0].code).toBe("existing_cleaner");
    }
  });

  it("marks row invalid when auth_user_id is missing", () => {
    const csv = `id,full_name,email,phone,auth_user_id
x,No Auth,0792022648@cleaner.shalean.com,+27792022648,
`;
    const plan = buildImportPlan(parseCsv(csv), { byPhone: new Map(), byProfileId: new Map() });
    expect(plan.plan[0]?.kind).toBe("invalid");
  });
});
