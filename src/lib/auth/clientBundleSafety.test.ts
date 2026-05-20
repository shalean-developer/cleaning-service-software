import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const CLIENT_ROOTS = [
  "src/app/sign-in",
  "src/app/sign-up",
  "src/app/reset-password",
  "src/components/auth",
  "src/lib/supabase/browser.ts",
];

const FORBIDDEN_PATTERNS = [
  /SUPABASE_SERVICE_ROLE_KEY/,
  /createServiceRoleClient/,
  /from ["']@\/lib\/supabase\/serviceRole["']/,
  /from ["']\.\/serviceRole["']/,
];

function collectSourceFiles(root: string): string[] {
  const abs = resolve(process.cwd(), root);
  let stat;
  try {
    stat = statSync(abs);
  } catch {
    return [];
  }

  if (stat.isFile()) {
    return /\.(tsx?|jsx?)$/.test(abs) ? [abs] : [];
  }

  const files: string[] = [];
  for (const name of readdirSync(abs)) {
    const child = join(abs, name);
    const childStat = statSync(child);
    if (childStat.isDirectory()) {
      files.push(...collectSourceFiles(join(root, name)));
    } else if (/\.(tsx?|jsx?)$/.test(name)) {
      files.push(child);
    }
  }
  return files;
}

describe("client auth bundle safety", () => {
  it("does not import or reference service role in browser-facing auth modules", () => {
    const files = CLIENT_ROOTS.flatMap((root) => collectSourceFiles(root));
    expect(files.length).toBeGreaterThan(0);

    for (const file of files) {
      const source = readFileSync(file, "utf8");
      for (const pattern of FORBIDDEN_PATTERNS) {
        expect(source, `${file} must not match ${pattern}`).not.toMatch(pattern);
      }
    }
  });
});
