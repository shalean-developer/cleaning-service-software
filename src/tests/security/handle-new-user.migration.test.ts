import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const MIGRATION_PATH = path.join(
  process.cwd(),
  "supabase/migrations/20260517_stage1c_harden_handle_new_user.sql",
);

describe("handle_new_user migration (Stage 1C-1)", () => {
  const sql = readFileSync(MIGRATION_PATH, "utf8");

  it("always inserts customer role and never reads raw_user_meta_data.role", () => {
    expect(sql).toMatch(/'customer'/);
    expect(sql).not.toMatch(/raw_user_meta_data\s*\?\s*'role'/);
    expect(sql).not.toMatch(/raw_user_meta_data->>'role'/);
    expect(sql).not.toMatch(/v_role/);
  });

  it("preserves full_name from metadata on insert", () => {
    expect(sql).toMatch(/raw_user_meta_data->>'full_name'/);
  });

  it("does not overwrite role on conflict", () => {
    const conflictBlock = sql.match(/on conflict \(id\) do update[\s\S]*?;/i)?.[0] ?? "";
    expect(conflictBlock.length).toBeGreaterThan(0);
    expect(conflictBlock).not.toMatch(/\brole\s*=/i);
    expect(conflictBlock).toMatch(/full_name/i);
  });
});
