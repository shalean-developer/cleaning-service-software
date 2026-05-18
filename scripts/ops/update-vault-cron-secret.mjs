#!/usr/bin/env node
import { readFileSync, writeFileSync, unlinkSync } from "fs";
import { execSync } from "child_process";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const env = Object.fromEntries(
  readFileSync(join(root, ".env.local"), "utf8")
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i), l.slice(i + 1)];
    }),
);

const secret = (env.CRON_SECRET ?? "").replace(/'/g, "''");
if (!secret) {
  console.error("CRON_SECRET missing in .env.local");
  process.exit(1);
}

const sql = `select vault.update_secret(
  '769a3d3c-3406-43be-b6b5-211a20b07854'::uuid,
  '${secret}',
  'cron_secret',
  'Bearer token for deferred dispatch and other cron routes'
);`;

const file = join(root, ".tmp-vault-update.sql");
writeFileSync(file, sql);
try {
  execSync(`npx supabase db query --linked --yes -f "${file}"`, {
    cwd: root,
    stdio: "inherit",
  });
  console.log("vault cron_secret updated");
} finally {
  unlinkSync(file);
}
