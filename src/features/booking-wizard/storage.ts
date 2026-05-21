import { INITIAL_WIZARD_STATE, type BookingWizardState } from "./types";
import { WIZARD_STORAGE_KEY } from "./constants";
import { WIZARD_STEPS } from "./types";
import {
  deriveOfficePropertySizeSqm,
  inferOfficeSizingFromPropertySizeSqm,
} from "./officeSizing";

const PERSIST_KEYS: (keyof BookingWizardState)[] = [
  "step",
  "serviceSlug",
  "date",
  "time",
  "addressLine1",
  "suburb",
  "city",
  "locationNotes",
  "contactPhone",
  "bedrooms",
  "bathrooms",
  "extraRooms",
  "cleaningIntensity",
  "equipmentSupply",
  "requestedTeamSize",
  "propertySizeSqm",
  "officeSizeTier",
  "officeWorkstations",
  "frequency",
  "recurringDays",
  "addons",
  "carpetStainSeverity",
  "carpetPetStains",
  "carpetGoodDryingAirflow",
  "specialInstructions",
  "cleanerPreferenceMode",
  "selectedCleanerId",
  "selectedCleanerDisplayName",
  "checkoutIdempotencyKey",
];

export function loadWizardState(): BookingWizardState {
  if (typeof window === "undefined") return INITIAL_WIZARD_STATE;

  try {
    const raw = window.localStorage.getItem(WIZARD_STORAGE_KEY);
    if (!raw) return INITIAL_WIZARD_STATE;
    const parsed = JSON.parse(raw) as Partial<BookingWizardState>;
    const step = WIZARD_STEPS.includes(parsed.step as (typeof WIZARD_STEPS)[number])
      ? (parsed.step as BookingWizardState["step"])
      : INITIAL_WIZARD_STATE.step;

    const persisted = pickPersisted(parsed);
    const requestedTeamSize =
      persisted.requestedTeamSize === 2 ? 2 : INITIAL_WIZARD_STATE.requestedTeamSize;

    let merged: BookingWizardState = {
      ...INITIAL_WIZARD_STATE,
      ...persisted,
      requestedTeamSize,
      step,
      profilePhone: null,
      quote: null,
      reviewConfirmed: false,
      availableCleaners: [],
      checkoutSubmitting: false,
      checkoutAttemptId: null,
      lockId: null,
      lockedBookingId: null,
    };

    if (merged.serviceSlug === "office-cleaning") {
      merged = hydrateOfficeWizardSizing(merged);
    }

    return merged;
  } catch {
    return INITIAL_WIZARD_STATE;
  }
}

export function saveWizardState(state: BookingWizardState): void {
  if (typeof window === "undefined") return;
  try {
    const payload = pickPersisted(state);
    window.localStorage.setItem(WIZARD_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // ignore quota / private mode
  }
}

export function clearWizardStorage(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(WIZARD_STORAGE_KEY);
  } catch {
    // ignore
  }
}

function hydrateOfficeWizardSizing(state: BookingWizardState): BookingWizardState {
  if (state.officeSizeTier && state.officeWorkstations) {
    return {
      ...state,
      propertySizeSqm: deriveOfficePropertySizeSqm(
        state.officeSizeTier,
        state.officeWorkstations,
      ),
    };
  }

  if (state.propertySizeSqm != null) {
    const inferred = inferOfficeSizingFromPropertySizeSqm(state.propertySizeSqm);
    if (inferred.officeSizeTier && inferred.officeWorkstations) {
      return {
        ...state,
        ...inferred,
        propertySizeSqm: deriveOfficePropertySizeSqm(
          inferred.officeSizeTier,
          inferred.officeWorkstations,
        ),
      };
    }
  }

  return state;
}

function pickPersisted(
  state: Partial<BookingWizardState>,
): Partial<BookingWizardState> {
  const out: Partial<BookingWizardState> = {};
  for (const key of PERSIST_KEYS) {
    if (key in state) {
      (out as Record<string, unknown>)[key] = state[key];
    }
  }
  return out;
}
