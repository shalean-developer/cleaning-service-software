import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

export const SRC_ROOT = path.resolve(process.cwd(), "src");

export const MIGRATIONS_ROOT = path.resolve(process.cwd(), "supabase/migrations");

export function collectTsFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (entry === "node_modules" || entry === ".next") continue;
      collectTsFiles(full, acc);
    } else if (entry.endsWith(".ts") && !entry.endsWith(".d.ts")) {
      acc.push(full);
    }
  }
  return acc;
}

export function collectSqlFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      collectSqlFiles(full, acc);
    } else if (entry.endsWith(".sql")) {
      acc.push(full);
    }
  }
  return acc;
}

export function relSrcPath(file: string): string {
  return path.relative(SRC_ROOT, file).replaceAll("\\", "/");
}

export function relMigrationPath(file: string): string {
  return path.relative(MIGRATIONS_ROOT, file).replaceAll("\\", "/");
}

export function scanSrcForPatterns(
  options: {
    allowedRelPaths: ReadonlySet<string>;
    skipTestFiles?: boolean;
    patterns: RegExp[];
  },
): string[] {
  const violations: string[] = [];
  const skipTests = options.skipTestFiles ?? true;

  for (const file of collectTsFiles(SRC_ROOT)) {
    const rel = relSrcPath(file);
    if (options.allowedRelPaths.has(rel)) continue;
    if (skipTests && rel.endsWith(".test.ts")) continue;

    const content = readFileSync(file, "utf8");
    for (const pattern of options.patterns) {
      if (pattern.test(content)) {
        violations.push(rel);
        break;
      }
    }
  }

  return violations;
}

export function scanMigrationsForPatterns(
  options: {
    allowedRelPaths: ReadonlySet<string>;
    patterns: RegExp[];
  },
): string[] {
  const violations: string[] = [];

  for (const file of collectSqlFiles(MIGRATIONS_ROOT)) {
    const rel = relMigrationPath(file);
    if (options.allowedRelPaths.has(rel)) continue;

    const content = readFileSync(file, "utf8");
    for (const pattern of options.patterns) {
      if (pattern.test(content)) {
        violations.push(rel);
        break;
      }
    }
  }

  return violations;
}

export function collectPostRoutes(apiDir: string, prefix = ""): string[] {
  const postRoutes: string[] = [];
  const entries = readdirSync(apiDir);

  for (const name of entries) {
    const full = path.join(apiDir, name);
    const rel = prefix ? `${prefix}/${name}` : name;
    if (statSync(full).isDirectory()) {
      postRoutes.push(...collectPostRoutes(full, rel));
    } else if (name === "route.ts") {
      const content = readFileSync(full, "utf8");
      if (/export\s+async\s+function\s+POST/.test(content)) {
        postRoutes.push(rel.replace(/\\/g, "/"));
      }
    }
  }

  return postRoutes;
}

export const SERVICE_ROLE_IMPORT_PATTERN =
  /from\s+["']@\/lib\/supabase\/serviceRole["']/;

export function collectServiceRoleImporterPaths(): string[] {
  const importers: string[] = [];

  for (const file of collectTsFiles(SRC_ROOT)) {
    const rel = relSrcPath(file);
    if (rel.endsWith(".test.ts")) continue;
    if (rel === "lib/supabase/serviceRole.ts") continue;

    const content = readFileSync(file, "utf8");
    if (SERVICE_ROLE_IMPORT_PATTERN.test(content)) {
      importers.push(rel);
    }
  }

  return importers.sort();
}
