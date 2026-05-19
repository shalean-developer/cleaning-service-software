import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { listCleanerOffersForDashboard } from "@/features/dashboards/server/cleanerJobReadModel";
import { partitionCleanerOffers } from "@/features/dashboards/server/partitionCleanerOffers";
import type { CleanerOfferListItem } from "@/features/dashboards/server/types";
import { CleanerOfferCard } from "@/components/dashboard/CleanerOfferCard";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { DashboardFetchError } from "@/components/dashboard/DashboardFetchError";
import { CLEANER_NAV_ITEMS } from "@/features/dashboards/cleanerNav";
import { EmptyState } from "@/components/dashboard/EmptyState";
import { dashboardFetchErrorTitle } from "@/lib/app/dashboardEcosystemDisplay";

export const metadata: Metadata = {
  title: "Offers | Cleaner",
};

export default async function CleanerOffersPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const result = await listCleanerOffersForDashboard(user);

  return (
    <DashboardShell
      title="Job offers"
      subtitle="When, where, pay — accept or decline."
      nav={[...CLEANER_NAV_ITEMS]}
    >
      {!result.ok ? (
        <DashboardFetchError
          title={dashboardFetchErrorTitle("offers", "cleaner")}
          description={result.message}
        />
      ) : result.offers.length === 0 ? (
        <EmptyState
          title="No offers right now"
          description="Matching jobs in your area will show up here."
        />
      ) : (
        <CleanerOffersList offers={result.offers} />
      )}
    </DashboardShell>
  );
}

function CleanerOffersList({
  offers,
}: {
  offers: CleanerOfferListItem[];
}) {
  const { needsResponse, pastOffers } = partitionCleanerOffers(offers);

  return (
    <section className="space-y-6 sm:space-y-8">
      <section>
        <h2 className="text-sm font-medium text-zinc-800">
          Needs your response{needsResponse.length > 0 ? ` (${needsResponse.length})` : ""}
        </h2>
        {needsResponse.length === 0 ? (
          <p className="mt-2 text-sm leading-relaxed text-zinc-600">
            You&apos;re all caught up — nothing needs a response right now.
          </p>
        ) : (
          <ul className="mt-3 space-y-3">
            {needsResponse.map((offer) => (
              <li key={offer.offerId}>
                <CleanerOfferCard offer={offer} />
              </li>
            ))}
          </ul>
        )}
      </section>

      {pastOffers.length > 0 ? (
        <section>
          <h2 className="text-sm font-medium text-zinc-800">
            Past offers ({pastOffers.length})
          </h2>
          <ul className="mt-3 space-y-3">
            {pastOffers.map((offer) => (
              <li key={offer.offerId}>
                <CleanerOfferCard offer={offer} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </section>
  );
}
