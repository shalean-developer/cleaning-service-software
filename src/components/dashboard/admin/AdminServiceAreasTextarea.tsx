"use client";

import { useMemo, useState } from "react";
import { getBookingLocationOptions } from "@/features/locations/locationRegistry";

const SUGGESTION_INPUT_ID = "admin-cleaner-service-area-suggest";

type Props = {
  name?: string;
  rows?: number;
  placeholder?: string;
  className?: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  "aria-invalid"?: boolean;
};

export function AdminServiceAreasTextarea({
  name = "serviceAreas",
  rows = 3,
  placeholder = "e.g. Sea Point — one per line or comma-separated",
  className,
  value,
  onChange,
  onBlur,
  "aria-invalid": ariaInvalid,
}: Props) {
  const options = getBookingLocationOptions();
  const [suggestion, setSuggestion] = useState("");

  const filtered = useMemo(() => {
    const q = suggestion.trim().toLowerCase();
    if (!q) return options.slice(0, 12);
    return options.filter((o) => o.label.toLowerCase().includes(q)).slice(0, 12);
  }, [options, suggestion]);

  function appendArea(label: string) {
    const trimmed = value.trim();
    const parts = trimmed ? trimmed.split(/[\n,]+/).map((p) => p.trim()) : [];
    if (parts.some((p) => p.toLowerCase() === label.toLowerCase())) return;
    const next = [...parts.filter(Boolean), label].join("\n");
    onChange(next);
    setSuggestion("");
  }

  return (
    <div className="space-y-2">
      <textarea
        name={name}
        rows={rows}
        placeholder={placeholder}
        className={className}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        aria-invalid={ariaInvalid}
      />
      <div>
        <label htmlFor={SUGGESTION_INPUT_ID} className="text-xs font-medium text-zinc-600">
          Add from registry
        </label>
        <input
          id={SUGGESTION_INPUT_ID}
          list={`${SUGGESTION_INPUT_ID}-list`}
          className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm text-zinc-900"
          value={suggestion}
          onChange={(e) => setSuggestion(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && suggestion.trim()) {
              e.preventDefault();
              const match =
                options.find((o) => o.label.toLowerCase() === suggestion.trim().toLowerCase()) ??
                filtered[0];
              if (match) appendArea(match.label);
            }
          }}
          placeholder="Search operational areas…"
        />
        <datalist id={`${SUGGESTION_INPUT_ID}-list`}>
          {filtered.map((opt) => (
            <option key={opt.slug} value={opt.label} />
          ))}
        </datalist>
        {suggestion.trim() && filtered[0] ? (
          <button
            type="button"
            className="mt-1 text-xs font-medium text-zinc-700 underline"
            onClick={() => appendArea(filtered[0]!.label)}
          >
            Add {filtered[0]!.label}
          </button>
        ) : null}
      </div>
    </div>
  );
}
