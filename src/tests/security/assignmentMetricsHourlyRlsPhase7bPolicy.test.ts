import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const MIGRATION = "20260520120000_assignment_metrics_hourly.sql";

describe("assignment_metrics_hourly RLS phase 7B-1a policy catalog (static)", () => {
  const sql = readFileSync(
    path.join(process.cwd(), "supabase/migrations", MIGRATION),
    "utf8",
  );

  it("defines admin-only select policy", () => {
    expect(sql).toMatch(
      /create\s+policy\s+assignment_metrics_hourly_select_admin\s+on\s+public\.assignment_metrics_hourly/i,
    );
    expect(sql).toMatch(/for select to authenticated/i);
    expect(sql).toMatch(/auth_is_admin\(\)/i);
  });
});
