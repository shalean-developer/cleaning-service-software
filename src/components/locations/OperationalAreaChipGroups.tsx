"use client";

import { useMemo, useState } from "react";
import {
  getCleanerAreaOptionGroups,
  getPopularOperationalAreas,
} from "@/features/locations/locationRegistry";
import { filterCleanerAreaOptionGroups } from "@/features/locations/operationalLocationSearch";

type Props = {
  selected: string[];
  onToggle: (areaName: string) => void;
  chipClass: (selected: boolean) => string;
  maxSelected?: number;
};

export function OperationalAreaChipGroups({
  selected,
  onToggle,
  chipClass,
  maxSelected,
}: Props) {
  const [search, setSearch] = useState("");
  const allGroups = useMemo(() => getCleanerAreaOptionGroups(), []);
  const popular = useMemo(() => getPopularOperationalAreas(), []);
  const filteredGroups = useMemo(
    () => filterCleanerAreaOptionGroups(allGroups, search),
    [allGroups, search],
  );

  const atMax = maxSelected != null && selected.length >= maxSelected;

  return (
    <div className="space-y-4">
      <input
        type="search"
        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search areas…"
        aria-label="Search preferred work areas"
      />
      <p className="text-xs text-slate-500">
        Not sure? Choose the closest area. you can update this later.
      </p>

      {selected.length > 0 ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
          <p className="text-xs font-medium text-slate-600">
            Selected ({selected.length}
            {maxSelected != null ? ` / ${maxSelected}` : ""})
          </p>
          <p className="mt-1 text-sm text-slate-800">{selected.join(", ")}</p>
        </div>
      ) : null}

      {atMax ? (
        <p className="text-xs text-amber-700">Maximum areas selected. Remove one to add another.</p>
      ) : null}

      {!search.trim() ? (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Popular Cape Town areas
          </p>
          <div className="flex flex-wrap gap-2">
            {popular.map((opt) => {
              const isSelected = selected.includes(opt.label);
              return (
                <button
                  key={opt.slug}
                  type="button"
                  disabled={atMax && !isSelected}
                  className={chipClass(isSelected)}
                  onClick={() => onToggle(opt.label)}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      <div className="max-h-72 space-y-4 overflow-y-auto pr-1">
        {filteredGroups.map((group) => (
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
                    disabled={atMax && !isSelected}
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
    </div>
  );
}
