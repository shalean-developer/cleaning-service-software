import { CleanerDashboardHeaderEnd } from "@/components/dashboard/cleaner/CleanerDashboardHeaderEnd";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { resolveProfileAvatarUrl } from "@/lib/auth/profileAvatarDisplay";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/** Server-rendered profile + notification slot for cleaner dashboard headers. */
export async function CleanerDashboardHeaderEndLoader() {
  const user = await getCurrentUser();
  if (!user) return null;

  const email = user.authUser.email?.trim() ?? "";
  const avatarUrl = resolveProfileAvatarUrl(
    user.authUser.user_metadata as Record<string, unknown>,
  );

  let fullName: string | null = null;
  let phone: string | null = null;
  const client = await createSupabaseServerClient();
  if (client) {
    const { data: profile } = await client
      .from("profiles")
      .select("full_name")
      .eq("id", user.profileId)
      .maybeSingle();
    fullName = profile?.full_name?.trim() ?? null;

    const { data: cleaner } = await client
      .from("cleaners")
      .select("phone")
      .eq("profile_id", user.profileId)
      .maybeSingle();
    phone = cleaner?.phone?.trim() ?? null;
  }

  return (
    <CleanerDashboardHeaderEnd
      fullName={fullName}
      email={email}
      phone={phone}
      avatarUrl={avatarUrl}
    />
  );
}
