"use client";

import { getCleanerAreaOptionGroups } from "@/features/locations/locationRegistry";

type Props = {
  selected: string[];
  onToggle: (areaName: string) => void;
  chipClass: (selected: boolean) => string;
};

export function OperationalAreaChipGroups({ selected, onToggle, chipClass }: Props) {
  const groups = getCleanerAreaOptionGroups();

  return (
    <div className="max-h-72 space-y-4 overflow-y-auto pr-1">
      {groups.map((group) => (
        <div key={group.region}>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            {group.region}
          </p>
          <div className="flex flex-wrap gap-2">
            {group.options.map((opt) => {
              const isSelected = selected.includes(opt.label);
              return (
                <button
                  key={opt.slug}
                  type="button"
                  title={opt.isSeoLocation ? "Featured service area" : undefined}
                  className={chipClass(isSelected)}
                  onClick={() => onToggle(opt.label)}
                >
                  {opt.label}
                  {opt.isSeoLocation ? (
                    <span className="sr-only"> (featured area)</span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
