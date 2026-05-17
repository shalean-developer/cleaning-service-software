import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const MIGRATION_PATH = path.join(
  process.cwd(),
  "supabase/migrations/20260519103000_notification_retention_dry_run_cron.sql",
);

describe("notification retention dry-run cron migration (Stage 5I-α soak)", () => {
  const sql = readFileSync(MIGRATION_PATH, "utf8");

  it("defines invoke function and daily pg_cron job", () => {
    expect(sql).toMatch(/invoke_notification_retention_dry_run_http/i);
    expect(sql).toMatch(/cleanup_notification_retention_cron_url/i);
    expect(sql).toMatch(/notification-retention-dry-run-daily/i);
    expect(sql).toMatch(/15 3 \* \* \*/);
  });

  it("does not delete or mutate notification tables", () => {
    expect(sql).not.toMatch(/delete from public\.notification_/i);
    expect(sql).not.toMatch(/update public\.notification_/i);
  });
});
