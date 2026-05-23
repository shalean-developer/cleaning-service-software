import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  ADMIN_POST_ALLOWLIST,
  API_ROOT,
  CLEANER_POST_ALLOWLIST,
  CRON_POST_ALLOWLIST,
  CUSTOMER_POST_ALLOWLIST,
  FORBIDDEN_READ_ONLY_POST_PATTERNS,
  FORBIDDEN_ROUTE_LIFECYCLE_PATTERNS,
  MUTATION_ROUTE_RULES,
  READ_ONLY_POST_ROUTE_RULES,
  SERVICE_ROLE_IMPORT_PATTERN,
} from "./mutationRouteBoundaryManifest";

const apiRootAbs = path.join(process.cwd(), API_ROOT);

function readRouteSource(routeFile: string): string {
  const abs = path.join(apiRootAbs, routeFile);
  expect(existsSync(abs), `missing route file: ${API_ROOT}/${routeFile}`).toBe(true);
  return readFileSync(abs, "utf8");
}

function hasImportSymbol(source: string, symbol: string): boolean {
  const fromNamed = new RegExp(
    `import\\s*\\{[^}]*\\b${symbol}\\b[^}]*\\}\\s*from`,
  );
  const defaultImport = new RegExp(`import\\s+${symbol}\\s+from`);
  return fromNamed.test(source) || defaultImport.test(source);
}

function matchingForbiddenPatterns(source: string, patterns: RegExp[]): string[] {
  return patterns.filter((p) => p.test(source)).map((p) => p.source);
}

describe("mutation route boundary guard (static)", () => {
  it("covers exactly 29 lifecycle mutation routes", () => {
    expect(MUTATION_ROUTE_RULES).toHaveLength(33);
  });

  it("covers exactly 3 read-only POST routes", () => {
    expect(READ_ONLY_POST_ROUTE_RULES).toHaveLength(3);
  });

  for (const rule of MUTATION_ROUTE_RULES) {
    describe(rule.routeFile, () => {
      it("imports required facade boundary", () => {
        const source = readRouteSource(rule.routeFile);
        const missing = rule.requiredFacadeImports.filter(
          (name) => !hasImportSymbol(source, name),
        );
        expect(missing, `missing facade import(s) in ${rule.routeFile}`).toEqual([]);
      });

      if (rule.requiredAdditionalImports && rule.requiredAdditionalImports.length > 0) {
        it("imports required additional symbols", () => {
          const source = readRouteSource(rule.routeFile);
          const additional = rule.requiredAdditionalImports!;
          const missing = additional.filter((name) => !hasImportSymbol(source, name));
          expect(missing).toEqual([]);
        });
      }

      it("does not contain direct lifecycle DML or command bypass patterns", () => {
        const source = readRouteSource(rule.routeFile);
        const hits = matchingForbiddenPatterns(source, FORBIDDEN_ROUTE_LIFECYCLE_PATTERNS);
        expect(hits, `forbidden pattern(s) in ${rule.routeFile}`).toEqual([]);
      });

      it("obeys service-role import policy", () => {
        const source = readRouteSource(rule.routeFile);
        const hasServiceRole = SERVICE_ROLE_IMPORT_PATTERN.test(source);
        if (rule.mayImportServiceRole) {
          expect(hasServiceRole, "cron routes must import service role client").toBe(true);
        } else {
          expect(
            hasServiceRole,
            `${rule.routeFile} must not import service role. use feature facades`,
          ).toBe(false);
        }
      });
    });
  }

  for (const rule of READ_ONLY_POST_ROUTE_RULES) {
    describe(`read-only ${rule.routeFile}`, () => {
      it("imports read facade only", () => {
        const source = readRouteSource(rule.routeFile);
        const missing = rule.requiredFacadeImports.filter(
          (name) => !hasImportSymbol(source, name),
        );
        expect(missing).toEqual([]);
      });

      it("does not import mutation boundaries or service role", () => {
        const source = readRouteSource(rule.routeFile);
        const hits = matchingForbiddenPatterns(source, FORBIDDEN_READ_ONLY_POST_PATTERNS);
        expect(hits).toEqual([]);
      });
    });
  }

  it("manifest customer routes match customer POST allowlist", () => {
    const fromManifest = MUTATION_ROUTE_RULES.filter((r) => r.category === "customer").map(
      (r) => r.routeFile,
    );
    const paystackCustomer = MUTATION_ROUTE_RULES.filter(
      (r) =>
        r.category === "paystack" &&
        r.routeFile !== "paystack/webhook/route.ts",
    ).map((r) => r.routeFile);

    const combined = [...fromManifest, ...paystackCustomer].sort();
    expect(combined).toEqual([...CUSTOMER_POST_ALLOWLIST].sort());
  });

  it("manifest cleaner routes match cleaner POST allowlist (admin-relative paths)", () => {
    const fromManifest = MUTATION_ROUTE_RULES.filter((r) => r.category === "cleaner").map(
      (r) => r.routeFile.replace(/^cleaner\//, ""),
    );
    expect(fromManifest.sort()).toEqual([...CLEANER_POST_ALLOWLIST].sort());
  });

  it("manifest admin routes match admin POST allowlist", () => {
    const fromManifest = MUTATION_ROUTE_RULES.filter((r) => r.category === "admin").map(
      (r) => r.routeFile.replace(/^admin\//, ""),
    );
    expect(fromManifest.sort()).toEqual([...ADMIN_POST_ALLOWLIST].sort());
  });

  it("manifest cron routes match cron POST allowlist", () => {
    const fromManifest = MUTATION_ROUTE_RULES.filter((r) => r.category === "cron").map(
      (r) => r.routeFile.replace(/^cron\//, ""),
    );
    expect(fromManifest.sort()).toEqual([...CRON_POST_ALLOWLIST].sort());
  });

  it("only cron mutation routes may import service role", () => {
    const nonCronWithServiceRole = MUTATION_ROUTE_RULES.filter(
      (r) => r.category !== "cron" && r.mayImportServiceRole,
    );
    expect(nonCronWithServiceRole).toEqual([]);

    const cronRules = MUTATION_ROUTE_RULES.filter((r) => r.category === "cron");
    expect(cronRules.every((r) => r.mayImportServiceRole)).toBe(true);
  });
});
