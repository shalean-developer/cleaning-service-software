import { beforeEach, describe, expect, it, vi } from "vitest";
import { persistCustomerSignupPhone } from "./persistCustomerSignupPhone";

const createSupabaseServerClientMock = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: () => createSupabaseServerClientMock(),
}));

describe("persistCustomerSignupPhone", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects invalid phone before calling Supabase", async () => {
    createSupabaseServerClientMock.mockResolvedValue({});
    const result = await persistCustomerSignupPhone("not-a-phone");
    expect(result).toEqual({
      ok: false,
      error: "Enter a valid South African mobile number.",
    });
    expect(createSupabaseServerClientMock).not.toHaveBeenCalled();
  });

  it("normalizes and saves phone on the customer row", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: "customer-1", error: null });
    const maybeSingle = vi.fn().mockResolvedValue({ data: { phone: null }, error: null });
    const updateEq = vi.fn().mockResolvedValue({ error: null });
    const update = vi.fn().mockReturnValue({ eq: updateEq });
    const selectEq = vi.fn().mockReturnValue({ maybeSingle });
    const select = vi.fn().mockReturnValue({ eq: selectEq });
    const from = vi.fn().mockReturnValue({ select, update });

    createSupabaseServerClientMock.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "profile-1" } },
          error: null,
        }),
      },
      rpc,
      from,
    });

    const result = await persistCustomerSignupPhone("082 123 4567");

    expect(result).toEqual({ ok: true });
    expect(rpc).toHaveBeenCalledWith("ensure_customer_provisioned", {
      profile_id: "profile-1",
    });
    expect(update).toHaveBeenCalledWith({ phone: "+27821234567" });
    expect(updateEq).toHaveBeenCalledWith("profile_id", "profile-1");
  });

  it("is idempotent when phone is already stored", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: "customer-1", error: null });
    const maybeSingle = vi
      .fn()
      .mockResolvedValue({ data: { phone: "+27821234567" }, error: null });
    const update = vi.fn();

    createSupabaseServerClientMock.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "profile-1" } },
          error: null,
        }),
      },
      rpc,
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({ maybeSingle }),
        }),
        update,
      }),
    });

    const result = await persistCustomerSignupPhone("+27821234567");

    expect(result).toEqual({ ok: true });
    expect(update).not.toHaveBeenCalled();
  });
});
