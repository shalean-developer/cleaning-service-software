import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const MIGRATION_PATH = path.join(
  process.cwd(),
  "supabase/migrations/20260521103000_assignment_metrics_hourly_path_split.sql",
);

describe("assignment_metrics_hourly path split migration (Stage 7B-1b-min)", () => {
  const sql = readFileSync(MIGRATION_PATH, "utf8");

  it("adds eight path-split integer columns with defaults", () => {
    expect(sql).toMatch(/offers_created_selected_count integer not null default 0/i);
    expect(sql).toMatch(/offers_created_best_available_count integer not null default 0/i);
    expect(sql).toMatch(/offers_created_admin_manual_count integer not null default 0/i);
    expect(sql).toMatch(/offers_created_unknown_count integer not null default 0/i);
    expect(sql).toMatch(/offers_accepted_selected_count integer not null default 0/i);
    expect(sql).toMatch(/offers_accepted_best_available_count integer not null default 0/i);
    expect(sql).toMatch(/offers_accepted_admin_manual_count integer not null default 0/i);
    expect(sql).toMatch(/offers_accepted_unknown_count integer not null default 0/i);
  });

  it("does not change RLS policies", () => {
    expect(sql).not.toMatch(/create policy/i);
    expect(sql).not.toMatch(/drop policy/i);
  });
});
