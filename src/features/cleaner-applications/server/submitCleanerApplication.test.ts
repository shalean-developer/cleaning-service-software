import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database/types";
import { submitCleanerApplication } from "./submitCleanerApplication";

function mockClient(options: {
  existingApplications?: { id: string }[];
  existingCleaners?: { id: string }[];
  existingByEmail?: { id: string }[];
  insertError?: { message: string } | null;
}) {
  const insert = vi.fn().mockResolvedValue({ error: options.insertError ?? null });

  const limitResult = (data: { id: string }[] | undefined) => ({
    limit: vi.fn().mockResolvedValue({ data: data ?? [] }),
  });

  const from = vi.fn((table: string) => {
    if (table === "cleaner_applications") {
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => limitResult(options.existingApplications)),
          ilike: vi.fn(() => limitResult(options.existingByEmail)),
        })),
        insert,
      };
    }
    if (table === "cleaners") {
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => limitResult(options.existingCleaners)),
        })),
      };
    }
    throw new Error(`unexpected table ${table}`);
  });

  return {
    client: { from } as unknown as SupabaseClient<Database>,
    insert,
  };
}

const validPayload = {
  fullName: "Thandi Nkosi",
  phone: "0821234567",
  suburb: "Sea Point",
  city: "Cape Town",
  availabilityDays: [1, 2],
  preferredAreas: ["Sea Point"],
  hasOwnTransport: true,
  workPreferences: ["regular_home_cleaning" as const, "airbnb_turnovers" as const],
  experienceLevel: "1_3_years" as const,
  workedInHomes: true,
  airbnbExperience: false,
  skills: {
    laundry: true,
    ironing: false,
    officeCleaning: false,
    petsOkay: true,
    familyHomesOkay: true,
  },
  notes: "5 years residential",
  references: [{ name: "Ref One", phone: "0831112222" }],
  consent: true as const,
};

describe("submitCleanerApplication", () => {
  it("inserts new application when no duplicate signals", async () => {
    const { client, insert } = mockClient({});
    const result = await submitCleanerApplication(validPayload, client);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.status).toBe("new");
      expect(result.duplicateLikely).toBe(false);
    }
    expect(insert).toHaveBeenCalledOnce();
    const row = insert.mock.calls[0]?.[0];
    expect(row.status).toBe("new");
    expect(row.suburb).toBe("Sea Point");
    expect(row.service_interests).toContain("regular-cleaning");
    expect(row.service_interests).toContain("airbnb-cleaning");
    expect(row.metadata.work_preferences).toEqual(validPayload.workPreferences);
    expect(row.email).toBe("0821234567@shalean.co.za");
  });

  it("derives shalean identity email from phone and ignores manual email", async () => {
    const { client, insert } = mockClient({});
    const result = await submitCleanerApplication(
      { ...validPayload, email: "manual@example.com" } as typeof validPayload & {
        email: string;
      },
      client,
    );

    expect(result.ok).toBe(true);
    expect(insert.mock.calls[0]?.[0].email).toBe("0821234567@shalean.co.za");
  });

  it("marks duplicate when phone already in applications", async () => {
    const { client, insert } = mockClient({
      existingApplications: [{ id: "existing" }],
    });
    const result = await submitCleanerApplication(validPayload, client);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.status).toBe("duplicate");
      expect(result.message).toContain("may already have your details");
    }
    expect(insert.mock.calls[0]?.[0].status).toBe("duplicate");
  });

  it("rejects honeypot submissions", async () => {
    const { client, insert } = mockClient({});
    const result = await submitCleanerApplication(
      { ...validPayload, website: "spam-bot" },
      client,
    );

    expect(result.ok).toBe(false);
    expect(insert).not.toHaveBeenCalled();
  });

  it("rejects invalid phone without insert", async () => {
    const { client, insert } = mockClient({});
    const result = await submitCleanerApplication(
      { ...validPayload, phone: "0111234567" },
      client,
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(["INVALID_PHONE", "INVALID_PAYLOAD"]).toContain(result.code);
    }
    expect(insert).not.toHaveBeenCalled();
  });

  it("rejects missing suburb", async () => {
    const { client, insert } = mockClient({});
    const result = await submitCleanerApplication(
      { ...validPayload, suburb: "" },
      client,
    );

    expect(result.ok).toBe(false);
    expect(insert).not.toHaveBeenCalled();
  });
});
