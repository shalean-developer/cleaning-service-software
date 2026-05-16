import { describe, expect, it, beforeEach, afterEach } from "vitest";
import {
  assertServiceRoleKey,
  decodeSupabaseJwtRole,
  formatApplicationAccessError,
  isLocalSupabaseUrl,
  isPostgrestPermissionDenied,
  phase1AuthEmail,
  PHASE1_TEST_EMAIL_DOMAIN,
  PHASE1_TEST_PREFIX,
  postgrestErrorText,
  resolvePhase1IntegrationGate,
} from "./phase1IntegrationTestSupport";

function fakeSupabaseJwt(role: string): string {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString(
    "base64url",
  );
  const payload = Buffer.from(JSON.stringify({ role, iss: "supabase" })).toString(
    "base64url",
  );
  return `${header}.${payload}.test-signature`;
}

describe("phase1IntegrationTestSupport", () => {
  const envBackup = { ...process.env };

  beforeEach(() => {
    process.env = { ...envBackup };
  });

  afterEach(() => {
    process.env = { ...envBackup };
  });

  it("treats localhost and 127.0.0.1 as local", () => {
    expect(isLocalSupabaseUrl("http://127.0.0.1:54321")).toBe(true);
    expect(isLocalSupabaseUrl("http://localhost:54321")).toBe(true);
    expect(isLocalSupabaseUrl("https://abc.supabase.co")).toBe(false);
  });

  it("skips when credentials are missing", () => {
    delete process.env.SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;

    const gate = resolvePhase1IntegrationGate();
    expect(gate.shouldRun).toBe(false);
    if (gate.shouldRun) return;
    expect(gate.skipReason).toMatch(/SUPABASE_URL/);
  });

  it("skips remote Supabase without explicit opt-in", () => {
    process.env.SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-key";
    delete process.env.BOOKING_COMMAND_RUN_REMOTE_INTEGRATION;

    const gate = resolvePhase1IntegrationGate();
    expect(gate.shouldRun).toBe(false);
    if (gate.shouldRun) return;
    expect(gate.skipReason).toMatch(/BOOKING_COMMAND_RUN_REMOTE_INTEGRATION/);
  });

  it("allows remote Supabase when opt-in is true", () => {
    process.env.SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-key";
    process.env.BOOKING_COMMAND_RUN_REMOTE_INTEGRATION = "true";

    const gate = resolvePhase1IntegrationGate();
    expect(gate.shouldRun).toBe(true);
    if (!gate.shouldRun) return;
    expect(gate.isRemote).toBe(true);
  });

  it("allows local Supabase without remote opt-in", () => {
    process.env.SUPABASE_URL = "http://127.0.0.1:54321";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-key";
    delete process.env.BOOKING_COMMAND_RUN_REMOTE_INTEGRATION;

    const gate = resolvePhase1IntegrationGate();
    expect(gate.shouldRun).toBe(true);
    if (!gate.shouldRun) return;
    expect(gate.isRemote).toBe(false);
  });

  it("uses test_phase1_ prefix constant", () => {
    expect(PHASE1_TEST_PREFIX).toBe("test_phase1_");
  });

  it("uses project email domain for auth users", () => {
    const runId = `${PHASE1_TEST_PREFIX}abc-123`;
    expect(phase1AuthEmail(runId)).toBe(`test_phase1_abc-123@${PHASE1_TEST_EMAIL_DOMAIN}`);
    expect(PHASE1_TEST_EMAIL_DOMAIN).toBe("shalean.co.za");
  });

  it("decodes service_role from a JWT payload", () => {
    const key = fakeSupabaseJwt("service_role");
    expect(decodeSupabaseJwtRole(key)).toBe("service_role");
    expect(() => assertServiceRoleKey(key)).not.toThrow();
  });

  it("rejects anon JWT with a clear message", () => {
    const key = fakeSupabaseJwt("anon");
    expect(decodeSupabaseJwtRole(key)).toBe("anon");
    expect(() => assertServiceRoleKey(key)).toThrow(
      "SUPABASE_SERVICE_ROLE_KEY is not a service_role key.",
    );
  });

  it("rejects publishable-style keys", () => {
    expect(() => assertServiceRoleKey("sb_publishable_example")).toThrow(
      "SUPABASE_SERVICE_ROLE_KEY is not a service_role key.",
    );
  });

  it("rejects non-JWT keys", () => {
    expect(() => assertServiceRoleKey("not-a-jwt")).toThrow(/not a valid Supabase JWT/);
  });

  it("detects PostgREST permission denied errors", () => {
    expect(isPostgrestPermissionDenied("permission denied for table customers")).toBe(
      true,
    );
    expect(isPostgrestPermissionDenied("connection refused")).toBe(false);
  });

  it("formats PostgREST errors with code when message is empty", () => {
    expect(postgrestErrorText({ code: "PGRST205" })).toBe("code=PGRST205");
    expect(
      formatApplicationAccessError({ code: "PGRST205", message: "" }),
    ).toMatch(/schema is missing/i);
  });
});
