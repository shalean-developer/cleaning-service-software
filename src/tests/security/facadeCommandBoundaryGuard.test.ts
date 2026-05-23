import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  MUTATION_ROUTE_RULES,
  READ_ONLY_POST_ROUTE_RULES,
} from "./mutationRouteBoundaryManifest";
import {
  ADMIN_OVERRIDE_PATTERN,
  EXECUTE_BOOKING_COMMAND_PATTERN,
  FACADE_BOUNDARY_RULES,
  FACADE_SRC_ROOT,
  FORBIDDEN_FACADE_OFFER_UPDATE_PATTERN,
  FORBIDDEN_FACADE_STATUS_PATTERNS,
  FORBIDDEN_READ_ONLY_FACADE_PATTERNS,
  ROUTE_FACADE_SYMBOL_TO_FILE,
  SERVICE_ROLE_IMPORT_PATTERN,
  type FacadeBoundaryRule,
} from "./facadeCommandBoundaryManifest";
import { ALLOWED_SERVICE_ROLE_LIFECYCLE_IMPORTERS } from "./serviceRoleLifecycleWriteRegistry.test";

const srcRootAbs = path.join(process.cwd(), FACADE_SRC_ROOT);

function readFacadeSource(facadeFile: string): string {
  const abs = path.join(srcRootAbs, facadeFile);
  expect(existsSync(abs), `missing facade file: ${FACADE_SRC_ROOT}/${facadeFile}`).toBe(true);
  return readFileSync(abs, "utf8");
}

function hasSymbolReference(source: string, symbol: string): boolean {
  return new RegExp(`\\b${symbol}\\b`).test(source);
}

function matchingPatterns(source: string, patterns: RegExp[]): string[] {
  return patterns.filter((p) => p.test(source)).map((p) => p.source);
}

function satisfiesCommandBoundary(rule: FacadeBoundaryRule, source: string): boolean {
  if (EXECUTE_BOOKING_COMMAND_PATTERN.test(source)) return true;
  const orchestrators = rule.allowedOrchestratorSymbols ?? [];
  return orchestrators.some((sym) => hasSymbolReference(source, sym));
}

function satisfiesPaymentOrchestrator(rule: FacadeBoundaryRule, source: string): boolean {
  const required = rule.requiredPaymentProcessors ?? [];
  return required.every((sym) => hasSymbolReference(source, sym));
}

function collectRouteFacadeSymbols(): string[] {
  const symbols = new Set<string>();
  for (const rule of MUTATION_ROUTE_RULES) {
    for (const sym of rule.requiredFacadeImports) {
      if (sym === "createBookingCommandBackend") continue;
      symbols.add(sym);
    }
  }
  for (const rule of READ_ONLY_POST_ROUTE_RULES) {
    for (const sym of rule.requiredFacadeImports) {
      symbols.add(sym);
    }
  }
  return [...symbols].sort();
}

describe("facade command boundary guard (static, 5B-2c-min)", () => {
  it("covers 23 unique route-referenced facade modules", () => {
    expect(FACADE_BOUNDARY_RULES).toHaveLength(28);
  });

  it("maps every route facade symbol to a manifest row", () => {
    const routeSymbols = collectRouteFacadeSymbols();
    const manifestFiles = new Set(FACADE_BOUNDARY_RULES.map((r) => r.facadeFile));

    for (const sym of routeSymbols) {
      const file = ROUTE_FACADE_SYMBOL_TO_FILE[sym];
      expect(file, `missing ROUTE_FACADE_SYMBOL_TO_FILE for ${sym}`).toBeDefined();
      expect(manifestFiles.has(file!), `${sym} → ${file} not in FACADE_BOUNDARY_RULES`).toBe(
        true,
      );
    }
  });

  for (const rule of FACADE_BOUNDARY_RULES) {
    describe(rule.facadeFile, () => {
      it("exists on disk", () => {
        readFacadeSource(rule.facadeFile);
      });

      if (rule.tier === "command_required") {
        it("calls executeBookingCommand or an approved orchestrator", () => {
          const source = readFacadeSource(rule.facadeFile);
          expect(
            satisfiesCommandBoundary(rule, source),
            `expected executeBookingCommand( or orchestrator in ${rule.facadeFile}`,
          ).toBe(true);
        });
      }

      if (rule.tier === "payment_orchestrator") {
        it("delegates to approved Paystack charge processors only", () => {
          const source = readFacadeSource(rule.facadeFile);
          expect(satisfiesPaymentOrchestrator(rule, source)).toBe(true);
          expect(EXECUTE_BOOKING_COMMAND_PATTERN.test(source)).toBe(false);
          expect(/\bfinalizePaidBooking\b/.test(source)).toBe(false);
        });
      }

      if (rule.tier === "lock_infra") {
        it("does not call executeBookingCommand (lock-only facade)", () => {
          const source = readFacadeSource(rule.facadeFile);
          expect(EXECUTE_BOOKING_COMMAND_PATTERN.test(source)).toBe(false);
        });
      }

      if (rule.tier === "offer_expiry") {
        it("is the documented expireOffers exception module", () => {
          expect(rule.facadeFile).toBe("features/assignments/server/expireOffers.ts");
          expect(rule.allowedDirectWriteException).toBe(true);
          const source = readFacadeSource(rule.facadeFile);
          expect(hasSymbolReference(source, "processBookingAfterOfferExpiry")).toBe(true);
        });
      }

      if (rule.tier === "read_only") {
        it("does not import command backends or lifecycle mutation helpers", () => {
          const source = readFacadeSource(rule.facadeFile);
          const hits = matchingPatterns(source, FORBIDDEN_READ_ONLY_FACADE_PATTERNS);
          expect(hits, `read-only facade ${rule.facadeFile}`).toEqual([]);
        });
      }

      it("does not reference ADMIN_OVERRIDE_STATUS", () => {
        const source = readFacadeSource(rule.facadeFile);
        expect(ADMIN_OVERRIDE_PATTERN.test(source)).toBe(false);
      });

      it("obeys service-role import policy vs 5B-2a registry", () => {
        const source = readFacadeSource(rule.facadeFile);
        const importsServiceRole = SERVICE_ROLE_IMPORT_PATTERN.test(source);
        const inRegistry = ALLOWED_SERVICE_ROLE_LIFECYCLE_IMPORTERS.has(rule.facadeFile);

        if (rule.allowedServiceRoleImport) {
          expect(
            importsServiceRole,
            `${rule.facadeFile} must import service role per manifest`,
          ).toBe(true);
          expect(inRegistry, `${rule.facadeFile} must be on service-role registry`).toBe(true);
        } else {
          expect(
            importsServiceRole,
            `${rule.facadeFile} must not import service role`,
          ).toBe(false);
        }
      });

      it("does not bypass lifecycle status / earning / payout writes", () => {
        const source = readFacadeSource(rule.facadeFile);

        if (rule.tier === "offer_expiry" && rule.allowedDirectWriteException) {
          const statusHits = matchingPatterns(source, FORBIDDEN_FACADE_STATUS_PATTERNS);
          const nonOfferHits = statusHits.filter(
            (p) => !p.includes("assignment_offers"),
          );
          expect(nonOfferHits).toEqual([]);
          return;
        }

        const statusHits = matchingPatterns(source, FORBIDDEN_FACADE_STATUS_PATTERNS);
        expect(statusHits, `forbidden lifecycle write in ${rule.facadeFile}`).toEqual([]);

        if (!rule.allowedDirectWriteException) {
          expect(
            FORBIDDEN_FACADE_OFFER_UPDATE_PATTERN.test(source),
            `direct assignment_offers.update in ${rule.facadeFile}`,
          ).toBe(false);
        }
      });
    });
  }
});
