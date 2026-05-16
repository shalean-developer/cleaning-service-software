import { WIZARD_STEPS, type WizardStep } from "./types";

export function stepIndex(step: WizardStep): number {
  return WIZARD_STEPS.indexOf(step);
}

export function nextStep(step: WizardStep): WizardStep | null {
  const idx = stepIndex(step);
  if (idx < 0 || idx >= WIZARD_STEPS.length - 1) return null;
  return WIZARD_STEPS[idx + 1]!;
}

export function previousStep(step: WizardStep): WizardStep | null {
  const idx = stepIndex(step);
  if (idx <= 0) return null;
  return WIZARD_STEPS[idx - 1]!;
}
