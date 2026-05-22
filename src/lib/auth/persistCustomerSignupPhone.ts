"use server";

import {
  normalizeSouthAfricanPhone,
  SOUTH_AFRICAN_MOBILE_INVALID_MESSAGE,
} from "@/lib/validation/southAfricanPhone";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type PersistCustomerSignupPhoneResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * Writes normalized phone to the authenticated customer's row after signup.
 * Idempotent when the same E.164 is already stored.
 */
export async function persistCustomerSignupPhone(
  phoneInput: string,
): Promise<PersistCustomerSignupPhoneResult> {
  const phoneE164 = normalizeSouthAfricanPhone(phoneInput);
  if (!phoneE164) {
    return { ok: false, error: SOUTH_AFRICAN_MOBILE_INVALID_MESSAGE };
  }

  const client = await createSupabaseServerClient();
  if (!client) {
    return {
      ok: false,
      error: "Account services are temporarily unavailable. Try again shortly.",
    };
  }

  const {
    data: { user },
    error: userError,
  } = await client.auth.getUser();

  if (userError || !user) {
    return { ok: false, error: "Sign in to continue." };
  }

  const { data: customerId, error: provisionError } = await client.rpc(
    "ensure_customer_provisioned",
    { profile_id: user.id },
  );

  if (provisionError) {
    return {
      ok: false,
      error: "We could not finish account setup. Please try again.",
    };
  }

  if (!customerId) {
    return {
      ok: false,
      error: "Account setup is still incomplete. Please try again.",
    };
  }

  const { data: existing, error: selectError } = await client
    .from("customers")
    .select("phone")
    .eq("profile_id", user.id)
    .maybeSingle();

  if (selectError) {
    return {
      ok: false,
      error: "We could not save your mobile number. Please try again.",
    };
  }

  if (existing?.phone === phoneE164) {
    return { ok: true };
  }

  const { error: updateError } = await client
    .from("customers")
    .update({ phone: phoneE164 })
    .eq("profile_id", user.id);

  if (updateError) {
    return {
      ok: false,
      error: "We could not save your mobile number. Please try again.",
    };
  }

  return { ok: true };
}
