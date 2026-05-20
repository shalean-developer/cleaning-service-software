import { CustomerDashboardHeaderEnd } from "@/components/dashboard/customer/CustomerDashboardHeaderEnd";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { resolveProfileAvatarUrl } from "@/lib/auth/profileAvatarDisplay";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/** Server-rendered profile + notification slot for customer dashboard headers. */
export async function CustomerDashboardHeaderEndLoader() {
  const user = await getCurrentUser();
  if (!user) return null;

  const email = user.authUser.email?.trim() ?? "";
  const avatarUrl = resolveProfileAvatarUrl(
    user.authUser.user_metadata as Record<string, unknown>,
  );

  let fullName: string | null = null;
  const client = await createSupabaseServerClient();
  if (client) {
    const { data: profile } = await client
      .from("profiles")
      .select("full_name")
      .eq("id", user.profileId)
      .maybeSingle();
    fullName = profile?.full_name?.trim() ?? null;
  }

  return (
    <CustomerDashboardHeaderEnd fullName={fullName} email={email} avatarUrl={avatarUrl} />
  );
}
