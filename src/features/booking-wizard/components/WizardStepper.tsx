import { WIZARD_STEPS, type WizardStep } from "../types";
import { WIZARD_STEP_LABELS } from "../constants";
import { stepIndex } from "../navigation";

type Props = {
  current: WizardStep;
};

export function WizardStepper({ current }: Props) {
  const currentIdx = stepIndex(current);
  const currentLabel = WIZARD_STEP_LABELS[current] ?? current;
  const stepNumber = currentIdx + 1;
  const totalSteps = WIZARD_STEPS.length;

  return (
    <nav aria-label="Booking progress" className="mb-3 md:mb-6">
      <div className="md:hidden">
        <p className="text-xs font-medium text-zinc-500">
          Step {stepNumber} of {totalSteps}
        </p>
        <p className="mt-0.5 text-sm font-semibold text-zinc-900" aria-current="step">
          {currentLabel}
        </p>
        <ol className="mt-2 flex gap-1" aria-hidden>
          {WIZARD_STEPS.map((step, idx) => {
            const done = idx < currentIdx;
            const active = step === current;
            return (
              <li
                key={step}
                className={`h-1 flex-1 rounded-full ${
                  active ? "bg-zinc-900" : done ? "bg-zinc-400" : "bg-zinc-200"
                }`}
              />
            );
          })}
        </ol>
      </div>

      <ol className="hidden w-full min-w-0 gap-0.5 md:flex">
        {WIZARD_STEPS.map((step, idx) => {
          const done = idx < currentIdx;
          const active = step === current;
          const fullLabel = WIZARD_STEP_LABELS[step] ?? step;

          return (
            <li
              key={step}
              aria-current={active ? "step" : undefined}
              className={`min-w-0 flex-1 rounded-lg px-2 py-1.5 text-center text-xs font-medium ${
                active
                  ? "bg-zinc-900 text-white"
                  : done
                    ? "bg-zinc-200 text-zinc-800"
                    : "bg-zinc-100 text-zinc-500"
              }`}
            >
              <span className="block truncate">{fullLabel}</span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
