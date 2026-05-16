import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database/types";
import { resolveActorScope } from "@/lib/auth/resolveActorScope";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { CurrentUser } from "./types";

export const PROVISIONING_INCOMPLETE_CODE = "PROVISIONING_INCOMPLETE" as const;

export const PROVISIONING_INCOMPLETE_MESSAGE =
  "Account setup is not complete. Finish setup before continuing." as const;

export type CustomerReadinessResult =
  | { status: "ready"; user: CurrentUser; actingCustomerId: string }
  | { status: "unauthenticated" }
  | { status: "wrong_role"; user: CurrentUser }
  | { status: "provisioning_incomplete"; user: CurrentUser };

export type CustomerProvisioningApiFailure = {
  ok: false;
  code: typeof PROVISIONING_INCOMPLETE_CODE;
  message: string;
  status: 403;
};

/** Standard 403 payload when a customer profile has no linked customers row. */
export function customerProvisioningApiFailure(
  message: string = PROVISIONING_INCOMPLETE_MESSAGE,
): CustomerProvisioningApiFailure {
  return {
    ok: false,
    code: PROVISIONING_INCOMPLETE_CODE,
    message,
    status: 403,
  };
}

async function resolveActingCustomerId(
  client: SupabaseClient<Database>,
  user: CurrentUser,
): Promise<string | null> {
  const ctx = await resolveActorScope(client, user.profileId, user.role);
  return ctx.actingCustomerId ?? null;
}

/**
 * Evaluates whether the signed-in user can act as a provisioned customer.
 */
export async function checkCustomerReadiness(
  existingUser?: CurrentUser | null,
): Promise<CustomerReadinessResult> {
  const { getCurrentUser } = await import("./getCurrentUser");
  const user = existingUser ?? (await getCurrentUser());
  if (!user) {
    return { status: "unauthenticated" };
  }
  if (user.role !== "customer") {
    return { status: "wrong_role", user };
  }

  const client = await createSupabaseServerClient();
  if (!client) {
    return { status: "provisioning_incomplete", user };
  }

  const actingCustomerId = await resolveActingCustomerId(client, user);
  if (!actingCustomerId) {
    return { status: "provisioning_incomplete", user };
  }

  return { status: "ready", user, actingCustomerId };
}
