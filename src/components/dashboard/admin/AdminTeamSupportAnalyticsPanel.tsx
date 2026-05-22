import Link from "next/link";
import type { AdminTeamSupportAnalytics } from "@/features/dashboards/server/types";
import { formatTeamSupportAnalyticsHomeSize } from "@/features/dashboards/server/adminTeamSupportObservation";
import { formatZar } from "@/features/dashboards/server/parseBookingDisplay";

type Props = {
  analytics: AdminTeamSupportAnalytics;
};

function MetricCard({
  title,
  value,
  hint,
}: {
  title: string;
  value: string;
  hint?: string;
}) {
  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-4">
      <h3 className="text-xs font-medium uppercase tracking-wide text-zinc-500">{title}</h3>
      <p className="mt-1 text-2xl font-semibold text-zinc-900">{value}</p>
      {hint ? <p className="mt-1 text-xs text-zinc-500">{hint}</p> : null}
    </section>
  );
}

export function AdminTeamSupportAnalyticsPanel({ analytics }: Props) {
  const teamPct =
    analytics.teamRequestPercent != null
      ? `${analytics.teamRequestPercent.toFixed(1)}%`
      : "-";

  return (
    <section className="space-y-6">
      <p className="text-sm text-zinc-600">
        Read-only observation from the newest {analytics.sampleSize} bookings (limit{" "}
        {analytics.sampleLimit}). Does not change assignment or payouts.
      </p>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <MetricCard
          title="Regular cleaning bookings"
          value={String(analytics.regularCleaningTotal)}
        />
        <MetricCard title="Team support requests" value={String(analytics.teamRequestTotal)} />
        <MetricCard title="Team request share" value={teamPct} />
        <MetricCard
          title="Avg price (team requests)"
          value={
            analytics.avgPriceCentsTeamRequests != null
              ? formatZar(analytics.avgPriceCentsTeamRequests)
              : "-"
          }
        />
        <MetricCard
          title="Avg home size (team requests)"
          value={formatTeamSupportAnalyticsHomeSize(analytics.avgHomeSizeUnitsTeamRequests)}
          hint="Bedroom + bathroom count proxy"
        />
        <MetricCard
          title="High operational load"
          value={String(analytics.operationalLoadHighCount)}
          hint="Team support + equipment + heavy"
        />
      </section>

      <section className="rounded-xl border border-violet-200 bg-violet-50/40 p-4">
        <h3 className="text-sm font-semibold text-violet-950">Manual fulfillment (recorded)</h3>
        <ul className="mt-2 space-y-1 text-sm text-violet-900">
          <li>2 cleaners recorded: {analytics.fulfillmentTwoCleaners}</li>
          <li>1 cleaner recorded: {analytics.fulfillmentOneCleaner}</li>
          <li>Not yet recorded: {analytics.fulfillmentUnrecorded}</li>
        </ul>
        <Link
          href="/admin/bookings?filter=two_cleaner_request"
          className="mt-3 inline-block text-sm font-medium text-violet-900 hover:underline"
        >
          View team support requests →
        </Link>
      </section>

      <section className="rounded-xl border border-zinc-200 bg-zinc-50/80 p-4 text-sm text-zinc-700">
        <h3 className="font-semibold text-zinc-900">Regular cleaning baseline</h3>
        <p className="mt-1">
          Avg price:{" "}
          {analytics.avgPriceCentsRegularCleaning != null
            ? formatZar(analytics.avgPriceCentsRegularCleaning)
            : "-"}
        </p>
        <p>
          Avg home size:{" "}
          {formatTeamSupportAnalyticsHomeSize(analytics.avgHomeSizeUnitsRegularCleaning)}
        </p>
      </section>
    </section>
  );
}
