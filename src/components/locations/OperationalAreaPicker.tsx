"use client";

import { useMemo, useState } from "react";
import {
  getCleanerAreaOptionGroups,
  getPopularOperationalAreas,
  type CleanerAreaOptionGroup,
} from "@/features/locations/locationRegistry";
import { formatLocationName } from "@/features/locations/locationDisplay";
import { filterCleanerAreaOptionGroups } from "@/features/locations/operationalLocationSearch";
import { parseServiceAreasInput } from "@/features/cleaners/admin/cleanerProfileFormValidation";

type Props = {
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  "aria-invalid"?: boolean;
  showAdvancedTextarea?: boolean;
  textareaClassName?: string;
};

function slugsFromInput(input: string): string[] {
  return parseServiceAreasInput(input);
}

function inputFromSlugs(slugs: string[]): string {
  return slugs.map((slug) => formatLocationName(slug)).join("\n");
}

function toggleSlug(slugs: string[], slug: string): string[] {
  const set = new Set(slugs);
  if (set.has(slug)) set.delete(slug);
  else set.add(slug);
  return [...set].sort();
}

function regionSlugs(group: CleanerAreaOptionGroup): string[] {
  return group.options.map((o) => o.slug);
}

export function OperationalAreaPicker({
  value,
  onChange,
  onBlur,
  "aria-invalid": ariaInvalid,
  showAdvancedTextarea = true,
  textareaClassName,
}: Props) {
  const [search, setSearch] = useState("");
  const [expandedRegions, setExpandedRegions] = useState<Set<string>>(() => new Set());
  const [showAdvanced, setShowAdvanced] = useState(false);

  const allGroups = useMemo(() => getCleanerAreaOptionGroups(), []);
  const popular = useMemo(() => getPopularOperationalAreas(), []);
  const filteredGroups = useMemo(
    () => filterCleanerAreaOptionGroups(allGroups, search),
    [allGroups, search],
  );

  const selectedSlugs = useMemo(() => slugsFromInput(value), [value]);

  function setSlugs(slugs: string[]) {
    onChange(inputFromSlugs(slugs));
  }

  function toggleRegion(group: CleanerAreaOptionGroup, select: boolean) {
    const regionSet = new Set(selectedSlugs);
    for (const slug of regionSlugs(group)) {
      if (select) regionSet.add(slug);
      else regionSet.delete(slug);
    }
    setSlugs([...regionSet]);
  }

  function toggleExpanded(region: string) {
    setExpandedRegions((prev) => {
      const next = new Set(prev);
      if (next.has(region)) next.delete(region);
      else next.add(region);
      return next;
    });
  }

  const isFiltering = search.trim().length > 0;

  return (
    <div className="space-y-3">
      <div>
        <label className="text-xs font-medium text-zinc-600">Search service areas</label>
        <input
          type="search"
          className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="e.g. Sea Point, Northern Suburbs…"
        />
      </div>

      <div>
        <p className="text-xs font-medium text-zinc-600">Quick add. featured areas</p>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {popular.map((opt) => {
            const selected = selectedSlugs.includes(opt.slug);
            return (
              <button
                key={opt.slug}
                type="button"
                className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                  selected
                    ? "border-zinc-900 bg-zinc-900 text-white"
                    : "border-zinc-200 bg-white text-zinc-800 hover:bg-zinc-50"
                }`}
                onClick={() => setSlugs(toggleSlug(selectedSlugs, opt.slug))}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      {selectedSlugs.length > 0 ? (
        <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2">
          <p className="text-xs font-medium text-zinc-600">
            Selected ({selectedSlugs.length})
          </p>
          <p className="mt-1 text-sm text-zinc-800">
            {selectedSlugs.map((s) => formatLocationName(s)).join(", ")}
          </p>
          <button
            type="button"
            className="mt-2 text-xs font-medium text-zinc-700 underline"
            onClick={() => setSlugs([])}
          >
            Clear all
          </button>
        </div>
      ) : (
        <p className="text-xs text-zinc-500">No areas selected. cleaner can serve all areas when empty.</p>
      )}

      <div className="max-h-72 space-y-2 overflow-y-auto rounded-lg border border-zinc-200 p-2">
        {filteredGroups.map((group) => {
          const expanded = isFiltering || expandedRegions.has(group.region);
          const regionSelected = regionSlugs(group).every((s) => selectedSlugs.includes(s));
          const regionPartial =
            !regionSelected && regionSlugs(group).some((s) => selectedSlugs.includes(s));

          return (
            <div key={group.region} className="rounded-md border border-zinc-100">
              <div className="flex items-center gap-2 bg-zinc-50 px-2 py-1.5">
                <button
                  type="button"
                  className="flex-1 text-left text-xs font-semibold uppercase tracking-wide text-zinc-600"
                  onClick={() => toggleExpanded(group.region)}
                  aria-expanded={expanded}
                >
                  {group.region}
                  <span className="ml-1 font-normal text-zinc-400">({group.options.length})</span>
                </button>
                <button
                  type="button"
                  className="text-xs font-medium text-zinc-700 underline"
                  onClick={() => toggleRegion(group, !regionSelected)}
                >
                  {regionSelected ? "Clear region" : regionPartial ? "Select all in region" : "Select all in region"}
                </button>
              </div>
              {expanded ? (
                <div className="flex flex-wrap gap-1.5 p-2">
                  {group.options.map((opt) => {
                    const selected = selectedSlugs.includes(opt.slug);
                    return (
                      <button
                        key={opt.slug}
                        type="button"
                        className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                          selected
                            ? "border-zinc-900 bg-zinc-900 text-white"
                            : "border-zinc-200 bg-white text-zinc-800 hover:bg-zinc-50"
                        }`}
                        onClick={() => setSlugs(toggleSlug(selectedSlugs, opt.slug))}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      {showAdvancedTextarea ? (
        <div>
          <button
            type="button"
            className="text-xs font-medium text-zinc-600 underline"
            onClick={() => setShowAdvanced((v) => !v)}
          >
            {showAdvanced ? "Hide" : "Show"} advanced paste
          </button>
          {showAdvanced ? (
            <textarea
              name="serviceAreas"
              rows={3}
              className={textareaClassName ?? "mt-2 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              onBlur={onBlur}
              aria-invalid={ariaInvalid}
              placeholder="One area per line or comma-separated"
            />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
