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

export const metadata: Metadata = {
  title: "Offers | Cleaner",
};

export default async function CleanerOffersPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const result = await listCleanerOffersForDashboard(user);

  return (
    <DashboardShell
      title="Assignment offers"
      subtitle="Accept or decline jobs offered to you."
      nav={[...CLEANER_NAV_ITEMS]}
    >
      {!result.ok ? (
        <DashboardFetchError
          title="Could not load offers"
          description={result.message}
        />
      ) : result.offers.length === 0 ? (
        <EmptyState
          title="No job offers right now"
          description="New offers will appear here when jobs are available."
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
    <section className="space-y-8">
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-700">
          Needs your response{needsResponse.length > 0 ? ` (${needsResponse.length})` : ""}
        </h2>
        {needsResponse.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-600">
            No offers need a response right now.
          </p>
        ) : (
          <ul className="mt-3 space-y-4">
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
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-700">
            Past offers ({pastOffers.length})
          </h2>
          <ul className="mt-3 space-y-4">
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
