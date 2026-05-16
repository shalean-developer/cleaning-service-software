import { afterEach, describe, expect, it } from "vitest";
import {
  createSupabaseBrowserClient,
  requireSupabaseBrowserClient,
  SupabaseBrowserConfigError,
} from "./browser";

describe("createSupabaseBrowserClient", () => {
  const prevUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const prevKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  afterEach(() => {
    if (prevUrl === undefined) {
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    } else {
      process.env.NEXT_PUBLIC_SUPABASE_URL = prevUrl;
    }
    if (prevKey === undefined) {
      delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    } else {
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = prevKey;
    }
  });

  it("returns null when public env is missing", () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    expect(createSupabaseBrowserClient()).toBeNull();
  });

  it("requireSupabaseBrowserClient throws a clear error when env is missing", () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    expect(() => requireSupabaseBrowserClient()).toThrow(SupabaseBrowserConfigError);
    expect(() => requireSupabaseBrowserClient()).toThrow(/NEXT_PUBLIC_SUPABASE/);
  });

  it("returns a client when public env is configured", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key-example";
    const client = createSupabaseBrowserClient();
    expect(client).not.toBeNull();
  });
});
