"use client";

import { useMemo, useState } from "react";
import type { ServiceSlug } from "@/features/pricing/server/types";
import type { CleanerPublicCard } from "@/features/cleaners/server/types";
import { getCleanerStepCopy } from "../airbnbCleaningDisplay";
import {
  filterDisplayableCleaners,
  getCleanerSelectionMode,
  getTeamOptionCopy,
  NO_INDIVIDUAL_CLEANERS_EMPTY_STATE,
  showsIndividualCleanerList,
} from "../cleanerSelectionPolicy";
import {
  CLEANER_LIST_INITIAL_VISIBLE,
  cleanerCardAriaLabel,
  cleanerCardExperienceHint,
  cleanerCardSubtitle,
} from "../cleanerStepDisplay";
import {
  WIZARD_CARD_TRANSITION,
  WIZARD_FOCUS_RING,
  wizardCardClass,
} from "../wizardSelection";
import { WIZARD_LOADING_CLEANERS_LABEL } from "@/lib/app/dashboardEcosystemDisplay";
import {
  UI_DETAILS_SUMMARY_COMPACT_CLASS,
  UI_INSET_PANEL_CLASS,
} from "@/lib/ui/productUiTokens";
import type { CleanerPreferenceMode } from "../types";
import { StarIcon } from "./wizardIcons";
import { WizardStepHeading } from "./WizardStepHeading";

type Props = {
  serviceSlug: ServiceSlug | null;
  cleanerPreferenceMode: CleanerPreferenceMode;
  selectedCleanerId: string | null;
  availableCleaners: CleanerPublicCard[];
  loading: boolean;
  onSelectBestAvailable: () => void;
  onSelectCleaner: (cleanerId: string, displayName: string) => void;
  selectedCleanerError?: string;
};

type CleanerListCardProps = {
  card: CleanerPublicCard;
  selected: boolean;
  onSelect: () => void;
};

function CleanerListCard({ card, selected, onSelect }: CleanerListCardProps) {
  const experienceHint = cleanerCardExperienceHint(card);

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-label={cleanerCardAriaLabel(card)}
      className={`flex w-full min-w-0 items-center gap-3 rounded-lg border px-3 py-2.5 text-left ${WIZARD_CARD_TRANSITION} ${WIZARD_FOCUS_RING} ${
        selected ? wizardCardClass(true) : wizardCardClass(false)
      }`}
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <span className="text-sm font-semibold text-zinc-900">{card.displayName}</span>
          {card.rating != null ? (
            <span className="inline-flex items-center gap-0.5 text-xs tabular-nums text-zinc-600">
              <StarIcon className="h-3 w-3 shrink-0" />
              {card.rating.toFixed(1)}
            </span>
          ) : null}
          {selected ? (
            <span className="rounded-full bg-zinc-900 px-2 py-0.5 text-[10px] font-semibold text-white">
              Selected
            </span>
          ) : null}
        </div>
        <p className="mt-0.5 line-clamp-1 text-xs leading-snug text-zinc-500">
          {cleanerCardSubtitle(card)}
        </p>
        {experienceHint ? (
          <p className="mt-0.5 line-clamp-1 text-[11px] text-zinc-400">{experienceHint}</p>
        ) : null}
      </div>
    </button>
  );
}

type TeamOptionButtonProps = {
  selected: boolean;
  title: string;
  description: string;
  showRecommendedBadge: boolean;
  onSelect: () => void;
};

function TeamOptionButton({
  selected,
  title,
  description,
  showRecommendedBadge,
  onSelect,
}: TeamOptionButtonProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`w-full rounded-xl border px-3.5 py-3 text-left ${WIZARD_CARD_TRANSITION} ${WIZARD_FOCUS_RING} ${
        selected ? wizardCardClass(true) : wizardCardClass(false)
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          {showRecommendedBadge ? (
            <span className="inline-flex rounded-full bg-zinc-900 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
              Recommended
            </span>
          ) : null}
          <p
            className={`text-sm font-semibold text-zinc-900 ${showRecommendedBadge ? "mt-1.5" : ""}`}
          >
            {title}
          </p>
          <p className="mt-0.5 text-xs leading-snug text-zinc-500">{description}</p>
        </div>
        {selected ? (
          <span className="shrink-0 rounded-full border border-zinc-900/15 bg-zinc-900/5 px-2 py-0.5 text-[10px] font-semibold text-zinc-800">
            Selected
          </span>
        ) : null}
      </div>
    </button>
  );
}

export function CleanerStepPanel({
  serviceSlug,
  cleanerPreferenceMode,
  selectedCleanerId,
  availableCleaners,
  loading,
  onSelectBestAvailable,
  onSelectCleaner,
  selectedCleanerError,
}: Props) {
  const [showAllCleaners, setShowAllCleaners] = useState(false);
  const selectionMode = getCleanerSelectionMode(serviceSlug);
  const teamOptionCopy = getTeamOptionCopy(selectionMode);
  const teamSelected = cleanerPreferenceMode === "best_available";
  const displayableCleaners = useMemo(
    () => filterDisplayableCleaners(availableCleaners),
    [availableCleaners],
  );
  const showCleanerList = showsIndividualCleanerList(selectionMode);
  const hasMoreThanInitial = displayableCleaners.length > CLEANER_LIST_INITIAL_VISIBLE;
  const visibleCleaners = showAllCleaners
    ? displayableCleaners
    : displayableCleaners.slice(0, CLEANER_LIST_INITIAL_VISIBLE);
  const copy = getCleanerStepCopy(serviceSlug);

  return (
    <div className="min-w-0">
      <WizardStepHeading title={copy.title} subtitle={copy.subtitle} />

      {selectionMode === "team_only" ? (
        <TeamOptionButton
          selected={teamSelected}
          title={teamOptionCopy.title}
          description={teamOptionCopy.description}
          showRecommendedBadge={teamOptionCopy.recommendedBadge}
          onSelect={onSelectBestAvailable}
        />
      ) : null}

      {showCleanerList ? (
        <>
          {cleanerPreferenceMode === "selected" ? (
            <p className="mb-3 text-xs leading-snug text-zinc-600">{copy.selectedHint}</p>
          ) : null}

          {loading && displayableCleaners.length === 0 ? (
            <p className="text-sm text-zinc-600">{WIZARD_LOADING_CLEANERS_LABEL}</p>
          ) : displayableCleaners.length > 0 ? (
            <section aria-labelledby="cleaner-list-heading" className="mb-3">
              <h3
                id="cleaner-list-heading"
                className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500"
              >
                Choose a cleaner
              </h3>
              <ul className="m-0 list-none space-y-2 p-0">
                {visibleCleaners.map((card) => (
                  <li key={card.cleanerId}>
                    <CleanerListCard
                      card={card}
                      selected={
                        cleanerPreferenceMode === "selected" &&
                        selectedCleanerId === card.cleanerId
                      }
                      onSelect={() => onSelectCleaner(card.cleanerId, card.displayName)}
                    />
                  </li>
                ))}
              </ul>
              {hasMoreThanInitial && !showAllCleaners ? (
                <button
                  type="button"
                  onClick={() => setShowAllCleaners(true)}
                  className="mt-2.5 w-full rounded-lg border border-zinc-200/90 bg-white py-2 text-sm font-medium text-zinc-800 hover:border-zinc-300 hover:bg-zinc-50"
                >
                  View all cleaners ({displayableCleaners.length})
                </button>
              ) : null}
              {hasMoreThanInitial && showAllCleaners ? (
                <button
                  type="button"
                  onClick={() => setShowAllCleaners(false)}
                  className="mt-2.5 w-full py-1.5 text-sm font-medium text-zinc-600 hover:text-zinc-900"
                >
                  Show fewer
                </button>
              ) : null}
            </section>
          ) : !loading ? (
            <p className="mb-3 rounded-lg border border-zinc-200/90 bg-zinc-50/80 px-3 py-2.5 text-sm leading-snug text-zinc-600">
              {NO_INDIVIDUAL_CLEANERS_EMPTY_STATE}
            </p>
          ) : null}

          <TeamOptionButton
            selected={teamSelected}
            title={teamOptionCopy.title}
            description={teamOptionCopy.description}
            showRecommendedBadge={teamOptionCopy.recommendedBadge}
            onSelect={onSelectBestAvailable}
          />
        </>
      ) : null}

      <details className={`mt-4 ${UI_INSET_PANEL_CLASS} px-3 py-2`}>
        <summary className={`${UI_DETAILS_SUMMARY_COMPACT_CLASS} py-2 text-zinc-700`}>
          How cleaner selection works
        </summary>
        <div className="mt-2 space-y-2 text-xs leading-relaxed text-zinc-600">
          {selectionMode === "team_only" ? (
            <p>
              <strong className="font-medium text-zinc-800">Shalean team</strong>{" "}
              {teamOptionCopy.description}
            </p>
          ) : (
            <>
              <p>
                <strong className="font-medium text-zinc-800">{teamOptionCopy.title}</strong>{" "}
                {teamOptionCopy.description}
              </p>
              <p>
                <strong className="font-medium text-zinc-800">Selected cleaner</strong>{" "}
                {copy.disclosureSelected}
              </p>
            </>
          )}
          {showCleanerList ? (
            <p className="text-zinc-500">
              Only cleaners available for your slot are shown. Ratings and availability hints help
              you compare.
            </p>
          ) : null}
        </div>
      </details>

      {selectedCleanerError ? (
        <p className="mt-2 text-sm text-red-600" role="alert">
          {selectedCleanerError}
        </p>
      ) : null}
    </div>
  );
}
