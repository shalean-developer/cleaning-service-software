import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { getCleanerDashboardOperationalContext } from "@/features/dashboards/server/cleanerOperationalContext";
import { CleanerOnboardingBanner } from "@/components/dashboard/cleaner/CleanerOnboardingBanner";

/** Operational lifecycle banner shown at the top of cleaner dashboard pages. */
export async function CleanerDashboardOperationalIntro() {
  const user = await getCurrentUser();
  if (!user) return null;

  const result = await getCleanerDashboardOperationalContext(user);
  if (!result.ok) return null;

  const { context } = result;
  return (
    <CleanerOnboardingBanner
      operationalState={context.operationalState}
      hasCapabilities={context.hasCapabilities}
      hasAvailability={context.hasAvailability}
    />
  );
}
