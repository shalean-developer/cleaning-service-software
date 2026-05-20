import { BookingWizard } from "@/features/booking-wizard/client";
import {
  extractLatestBookingAddressDefaults,
  type LatestBookingAddressDefaults,
} from "@/features/booking-wizard/latestBookingAddressDefaults";
import type { ServiceSlug } from "@/features/pricing/server/types";
import { resolveProfileAvatarUrl } from "@/lib/auth/profileAvatarDisplay";
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
  let profileFullName: string | null = null;
  let initialAddressDefaults: LatestBookingAddressDefaults | null = null;
  const client = await createSupabaseServerClient();
  if (client) {
    const [{ data: customer }, { data: profile }, { data: latestBooking }] =
      await Promise.all([
        client
          .from("customers")
          .select("phone")
          .eq("profile_id", readiness.user.profileId)
          .maybeSingle(),
        client
          .from("profiles")
          .select("full_name")
          .eq("id", readiness.user.profileId)
          .maybeSingle(),
        client
          .from("bookings")
          .select("metadata")
          .eq("customer_id", readiness.actingCustomerId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);
    initialCustomerPhone = customer?.phone?.trim() ?? null;
    profileFullName = profile?.full_name?.trim() ?? null;
    if (latestBooking?.metadata) {
      const extracted = extractLatestBookingAddressDefaults(latestBooking.metadata);
      initialAddressDefaults = Object.keys(extracted).length > 0 ? extracted : null;
    }
  }

  const avatarUrl = resolveProfileAvatarUrl(
    readiness.user.authUser.user_metadata as Record<string, unknown>,
  );

  return (
    <BookingWizard
      customerEmail={email}
      profileMenu={{
        fullName: profileFullName,
        email,
        avatarUrl,
      }}
      initialServiceSlug={initialServiceSlug}
      initialCustomerPhone={initialCustomerPhone}
      initialAddressDefaults={initialAddressDefaults}
    />
  );
}
