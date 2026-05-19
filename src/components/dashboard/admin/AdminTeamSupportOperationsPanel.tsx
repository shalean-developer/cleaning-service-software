"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type {
  AdminOperationalLoadSignals,
  TeamCoordinationStatus,
  TeamRequestFulfillment,
  TeamSupportOps,
} from "@/features/dashboards/server/adminTeamSupportObservation";
import {
  buildAdminOperationalLoadBadges,
  supportingCleanerDisplayLabel,
  teamCoordinationStatusLabel,
} from "@/features/dashboards/server/adminTeamSupportObservation";
import {
  ADMIN_DETAIL_CARD_CLASS,
  ADMIN_SECTION_MUTED_CLASS,
  ADMIN_SECTION_TITLE_CLASS,
} from "@/features/dashboards/adminDisplay";

type Props = {
  bookingId: string;
  isTwoCleanerRequest: boolean;
  assignedCleanerLabel: string | null;
  homeSizeSummary: string | null;
  cleaningIntensityLabel: string | null;
  equipmentSupplyLabel: string | null;
  operationalLoad: AdminOperationalLoadSignals;
  teamRequestFulfillment: TeamRequestFulfillment | null;
  teamRequestFulfillmentLabel: string | null;
  initialTeamSupportOps: TeamSupportOps;
  initialCoordinationStatusLabel: string | null;
};

export function AdminTeamSupportOperationsPanel({
  bookingId,
  isTwoCleanerRequest,
  assignedCleanerLabel,
  homeSizeSummary,
  cleaningIntensityLabel,
  equipmentSupplyLabel,
  operationalLoad,
  teamRequestFulfillment,
  teamRequestFulfillmentLabel,
  initialTeamSupportOps,
  initialCoordinationStatusLabel,
}: Props) {
  const router = useRouter();
  const [teamSupportOps, setTeamSupportOps] = useState(initialTeamSupportOps);
  const [coordinationLabel, setCoordinationLabel] = useState(initialCoordinationStatusLabel);
  const [fulfillment, setFulfillment] = useState(teamRequestFulfillment);
  const [fulfillmentLabel, setFulfillmentLabel] = useState(teamRequestFulfillmentLabel);
  const [supportingName, setSupportingName] = useState(
    initialTeamSupportOps.supportingCleaner?.name ?? "",
  );
  const [supportingProfileId, setSupportingProfileId] = useState(
    initialTeamSupportOps.supportingCleaner?.profileId ?? "",
  );
  const [notes, setNotes] = useState(initialTeamSupportOps.teamSupportNotes ?? "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isTwoCleanerRequest) return null;

  async function patchOps(body: Record<string, unknown>) {
    setPending(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/bookings/${bookingId}/team-support-ops`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = (await response.json()) as {
        ok?: boolean;
        message?: string;
        teamSupportOps?: TeamSupportOps;
      };
      if (!response.ok || !payload.ok || !payload.teamSupportOps) {
        setError(payload.message ?? "Could not save team support ops.");
        return;
      }
      setTeamSupportOps(payload.teamSupportOps);
      setCoordinationLabel(
        teamCoordinationStatusLabel(payload.teamSupportOps.coordinationStatus, true),
      );
      if (payload.teamSupportOps.supportingCleaner) {
        setSupportingName(payload.teamSupportOps.supportingCleaner.name ?? "");
        setSupportingProfileId(payload.teamSupportOps.supportingCleaner.profileId ?? "");
      }
      setNotes(payload.teamSupportOps.teamSupportNotes ?? "");
      router.refresh();
    } catch {
      setError("Network error — try again.");
    } finally {
      setPending(false);
    }
  }

  async function saveFulfillment(count: 1 | 2) {
    setPending(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/admin/bookings/${bookingId}/team-request-fulfillment`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fulfilledCleanerCount: count }),
        },
      );
      const body = (await response.json()) as {
        ok?: boolean;
        message?: string;
        fulfillment?: TeamRequestFulfillment;
      };
      if (!response.ok || !body.ok || !body.fulfillment) {
        setError(body.message ?? "Could not save fulfillment.");
        return;
      }
      setFulfillment(body.fulfillment);
      setFulfillmentLabel(
        count === 2 ? "2 cleaners recorded (manual)" : "1 cleaner recorded (manual)",
      );
      router.refresh();
    } catch {
      setError("Network error — try again.");
    } finally {
      setPending(false);
    }
  }

  const loadBadges = buildAdminOperationalLoadBadges(operationalLoad);
  const supportingLabel = supportingCleanerDisplayLabel(teamSupportOps.supportingCleaner);

  return (
    <section className={`${ADMIN_DETAIL_CARD_CLASS} border-violet-200/80 bg-violet-50/25 p-4 sm:p-5`}>
      <h2 className={`${ADMIN_SECTION_TITLE_CLASS} text-violet-950`}>
        Team support operations
      </h2>
      <p className={ADMIN_SECTION_MUTED_CLASS}>
        Operational coordination only — does not change assignment, payouts, lifecycle, or
        dispatch. One assigned cleaner remains the system assignee.
      </p>

      <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
        <DetailItem label="Customer request" value="Team support requested (paid)" />
        <DetailItem
          label="Operational load"
          value={`Score ${operationalLoad.operationalLoadScore}`}
        />
        {homeSizeSummary ? <DetailItem label="Home size" value={homeSizeSummary} /> : null}
        {cleaningIntensityLabel ? (
          <DetailItem label="Cleaning intensity" value={cleaningIntensityLabel} />
        ) : null}
        {equipmentSupplyLabel ? (
          <DetailItem label="Equipment" value={equipmentSupplyLabel} />
        ) : null}
        <DetailItem
          label="Assigned cleaner"
          value={assignedCleanerLabel ?? "Unassigned"}
          muted={!assignedCleanerLabel}
        />
        <DetailItem
          label="Cleaner fulfillment"
          value={fulfillmentLabel ?? "Admin follow-up required"}
        />
        <DetailItem
          label="Coordination status"
          value={coordinationLabel ?? "Admin follow-up required"}
        />
        {supportingLabel ? (
          <DetailItem
            label="Supporting cleaner (ops)"
            value={supportingLabel}
            className="sm:col-span-2"
          />
        ) : null}
      </dl>

      {loadBadges.length > 0 ? (
        <ul className="mt-3 flex flex-wrap gap-1.5">
          {loadBadges.map((badge) => (
            <li
              key={badge.label}
              className="rounded-full bg-white/80 px-2 py-0.5 text-xs font-medium text-violet-900 ring-1 ring-violet-200"
            >
              {badge.label}
            </li>
          ))}
        </ul>
      ) : null}

      <div className="mt-5 space-y-4 border-t border-violet-200/60 pt-4">
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-violet-900">
            Supporting cleaner (not assignee)
          </h3>
          <p className="mt-1 text-xs text-zinc-600">
            Record a partner cleaner for ops coordination — not a second assignment.
          </p>
          <div className="mt-2 grid gap-3 sm:grid-cols-2">
            <label className="block text-xs font-medium text-zinc-600">
              Name
              <input
                type="text"
                value={supportingName}
                onChange={(e) => setSupportingName(e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                placeholder="Partner name"
              />
            </label>
            <label className="block text-xs font-medium text-zinc-600">
              Profile ID
              <input
                type="text"
                value={supportingProfileId}
                onChange={(e) => setSupportingProfileId(e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 font-mono text-sm"
                placeholder="UUID (optional)"
              />
            </label>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                patchOps({
                  supportingCleaner: {
                    name: supportingName || undefined,
                    profileId: supportingProfileId || undefined,
                  },
                })
              }
              className="rounded-lg bg-violet-900 px-3 py-2 text-sm font-medium text-white hover:bg-violet-800 disabled:opacity-60"
            >
              Save supporting cleaner
            </button>
            {teamSupportOps.supportingCleaner ? (
              <button
                type="button"
                disabled={pending}
                onClick={() => {
                  setSupportingName("");
                  setSupportingProfileId("");
                  void patchOps({ supportingCleaner: null });
                }}
                className="rounded-lg border border-violet-300 bg-white px-3 py-2 text-sm font-medium text-violet-950 hover:bg-violet-50 disabled:opacity-60"
              >
                Clear
              </button>
            ) : null}
          </div>
        </div>

        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-violet-900">
            Operational notes
          </h3>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={4}
            className="mt-2 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
            placeholder="Coordination notes, arrival sequencing, equipment coordination, fallback decisions…"
          />
          <button
            type="button"
            disabled={pending}
            onClick={() => patchOps({ teamSupportNotes: notes.trim() || null })}
            className="mt-2 rounded-lg border border-violet-300 bg-white px-3 py-2 text-sm font-medium text-violet-950 hover:bg-violet-50 disabled:opacity-60"
          >
            Save notes
          </button>
        </div>

        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-violet-900">
            Coordination status
          </h3>
          <p className="mt-1 text-xs text-zinc-600">
            Ops visibility only — not connected to booking lifecycle.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {(
              [
                ["awaiting_coordination", "Awaiting coordination"],
                ["partially_fulfilled", "Partially coordinated"],
                ["fully_coordinated", "Fully coordinated"],
              ] as const satisfies [TeamCoordinationStatus, string][]
            ).map(([status, label]) => (
              <button
                key={status}
                type="button"
                disabled={pending}
                onClick={() => patchOps({ coordinationStatus: status })}
                className={`rounded-lg px-3 py-2 text-sm font-medium disabled:opacity-60 ${
                  teamSupportOps.coordinationStatus?.status === status
                    ? "bg-violet-900 text-white"
                    : "border border-violet-300 bg-white text-violet-950 hover:bg-violet-50"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-violet-900">
            Cleaner fulfillment record
          </h3>
          {fulfillment ? (
            <p className="mt-1 text-xs text-zinc-500">
              Recorded {new Date(fulfillment.recordedAt).toLocaleString("en-ZA")}
            </p>
          ) : null}
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={() => saveFulfillment(2)}
              className="rounded-lg bg-violet-900 px-3 py-2 text-sm font-medium text-white hover:bg-violet-800 disabled:opacity-60"
            >
              Record 2-cleaner fulfillment
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => saveFulfillment(1)}
              className="rounded-lg border border-violet-300 bg-white px-3 py-2 text-sm font-medium text-violet-950 hover:bg-violet-50 disabled:opacity-60"
            >
              Record 1-cleaner fulfillment
            </button>
          </div>
        </div>
      </div>

      {error ? (
        <p className="mt-3 text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}

function DetailItem({
  label,
  value,
  muted,
  className,
}: {
  label: string;
  value: string;
  muted?: boolean;
  className?: string;
}) {
  return (
    <div className={className}>
      <dt className="text-xs font-medium text-zinc-500">{label}</dt>
      <dd className={muted ? "text-zinc-500" : "font-medium text-zinc-900"}>{value}</dd>
    </div>
  );
}
