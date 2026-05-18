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
      title="Job offers"
      subtitle="Review when, where, and pay — then accept or decline."
      nav={[...CLEANER_NAV_ITEMS]}
    >
      {!result.ok ? (
        <DashboardFetchError
          title="Could not load offers"
          description={result.message}
        />
      ) : result.offers.length === 0 ? (
        <EmptyState
          title="No offers right now"
          description="New jobs will appear here when they match your area and availability."
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
            You're all caught up — no offers need a response.
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
