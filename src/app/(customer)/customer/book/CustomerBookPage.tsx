import { BookingWizard } from "@/features/booking-wizard/client";
import type { ServiceSlug } from "@/features/pricing/server/types";
import { checkCustomerReadiness } from "@/lib/auth/customerReadiness";
import { requireCustomerReady } from "@/lib/auth/requireCustomerReady";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type Props = {
  redirectPath: string;
  initialServiceSlug?: ServiceSlug;
};

export async function CustomerBookPage({ redirectPath, initialServiceSlug }: Props) {
  await requireCustomerReady(redirectPath);

  const readiness = await checkCustomerReadiness();
  if (readiness.status !== "ready") {
    return null;
  }

  const email = readiness.user.authUser.email?.trim() ?? "";

  let initialCustomerPhone: string | null = null;
  const client = await createSupabaseServerClient();
  if (client) {
    const { data: customer } = await client
      .from("customers")
      .select("phone")
      .eq("profile_id", readiness.user.profileId)
      .maybeSingle();
    initialCustomerPhone = customer?.phone?.trim() ?? null;
  }

  return (
    <BookingWizard
      customerEmail={email}
      initialServiceSlug={initialServiceSlug}
      initialCustomerPhone={initialCustomerPhone}
    />
  );
}
