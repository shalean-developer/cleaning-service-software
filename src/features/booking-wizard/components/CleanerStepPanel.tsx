"use client";

import type { CleanerPublicCard } from "@/features/cleaners/server/types";
import {
  WIZARD_CARD_TRANSITION,
  WIZARD_FOCUS_RING,
  wizardCardClass,
} from "../wizardSelection";
import { WIZARD_LOADING_CLEANERS_LABEL } from "@/lib/app/dashboardEcosystemDisplay";
import type { CleanerPreferenceMode } from "../types";
import { StarIcon } from "./wizardIcons";
import { WizardStepHeading } from "./WizardStepHeading";

type Props = {
  cleanerPreferenceMode: CleanerPreferenceMode;
  selectedCleanerId: string | null;
  availableCleaners: CleanerPublicCard[];
  loading: boolean;
  onSelectBestAvailable: () => void;
  onSelectCleaner: (cleanerId: string, displayName: string) => void;
  selectedCleanerError?: string;
};

export function CleanerStepPanel({
  cleanerPreferenceMode,
  selectedCleanerId,
  availableCleaners,
  loading,
  onSelectBestAvailable,
  onSelectCleaner,
  selectedCleanerError,
}: Props) {
  return (
    <div>
      <WizardStepHeading
        title="Cleaner preference"
        subtitle="Choose a specific cleaner or let us assign the best match."
      />

      <button
        type="button"
        onClick={onSelectBestAvailable}
        className={`mb-3 w-full rounded-xl border px-4 py-3 text-left ${WIZARD_CARD_TRANSITION} ${WIZARD_FOCUS_RING} ${
          cleanerPreferenceMode === "best_available"
            ? wizardCardClass(true)
            : wizardCardClass(false)
        }`}
      >
        <span className="font-medium text-zinc-900">Best available</span>
        <span className="mt-1 block text-xs text-zinc-600">
          We&apos;ll match the highest-rated eligible cleaner.
        </span>
      </button>

      {loading && availableCleaners.length === 0 ? (
        <p className="text-sm text-zinc-600">{WIZARD_LOADING_CLEANERS_LABEL}</p>
      ) : (
        <ul className="max-h-64 space-y-2 overflow-y-auto">
          {availableCleaners.map((card) => {
            const selected =
              cleanerPreferenceMode === "selected" && selectedCleanerId === card.cleanerId;
            const disabled = card.eligibilityStatus !== "eligible";

            return (
              <li key={card.cleanerId}>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => onSelectCleaner(card.cleanerId, card.displayName)}
                  className={`w-full rounded-xl border px-3 py-2 text-left text-sm text-zinc-900 ${WIZARD_CARD_TRANSITION} ${WIZARD_FOCUS_RING} ${
                    selected
                      ? wizardCardClass(true)
                      : disabled
                        ? "cursor-not-allowed border-zinc-100 bg-zinc-50 text-zinc-400"
                        : wizardCardClass(false)
                  }`}
                >
                  <span className="font-medium">{card.displayName}</span>
                  {card.rating != null ? (
                    <span className="ml-2 inline-flex items-center gap-0.5 text-xs text-zinc-600">
                      <StarIcon className="h-3 w-3" />
                      {card.rating.toFixed(1)}
                    </span>
                  ) : null}
                  <span className="mt-1 block text-xs text-zinc-500">{card.eligibilityReason}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {selectedCleanerError ? (
        <p className="mt-2 text-sm text-red-600">{selectedCleanerError}</p>
      ) : null}
    </div>
  );
}
