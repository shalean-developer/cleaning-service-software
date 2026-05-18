import { WIZARD_STEPS, type WizardStep } from "../types";
import { WIZARD_STEP_LABELS } from "../constants";
import { stepIndex } from "../navigation";

type Props = {
  current: WizardStep;
};

export function WizardStepper({ current }: Props) {
  const currentIdx = stepIndex(current);

  return (
    <nav aria-label="Booking progress" className="mb-6">
      <ol className="flex gap-0.5 overflow-x-auto pb-1">
        {WIZARD_STEPS.map((step, idx) => {
          const done = idx < currentIdx;
          const active = step === current;
          return (
            <li
              key={step}
              className={`min-w-[4rem] flex-1 rounded-lg px-2 py-1.5 text-center text-xs font-medium ${
                active
                  ? "bg-zinc-900 text-white"
                  : done
                    ? "bg-zinc-200 text-zinc-800"
                    : "bg-zinc-100 text-zinc-500"
              }`}
            >
              <span className="block truncate">{WIZARD_STEP_LABELS[step]}</span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
