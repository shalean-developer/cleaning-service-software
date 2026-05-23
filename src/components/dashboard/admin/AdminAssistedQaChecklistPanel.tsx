"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ADMIN_ASSIST_QA_CHECKLIST_KEYS,
  ADMIN_ASSIST_QA_CHECKLIST_LABELS,
  type AdminAssistQaChecklistItems,
} from "@/features/bookings/adminAssistQaChecklistShared";

type Props = {
  bookingId: string;
  initialItems?: AdminAssistQaChecklistItems;
};

export function AdminAssistedQaChecklistPanel({ bookingId, initialItems }: Props) {
  const [items, setItems] = useState<AdminAssistQaChecklistItems>(initialItems ?? {});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialItems) setItems(initialItems);
  }, [initialItems]);

  const onToggle = useCallback(
    async (key: (typeof ADMIN_ASSIST_QA_CHECKLIST_KEYS)[number]) => {
      const next = { ...items, [key]: !items[key] };
      setItems(next);
      setSaving(true);
      setError(null);
      try {
        const response = await fetch(`/api/admin/bookings/${bookingId}/assist-qa-checklist`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ items: next }),
        });
        const json = (await response.json()) as { ok: boolean; message?: string };
        if (!response.ok || !json.ok) {
          setError(json.message ?? "Could not save checklist.");
          setItems(items);
          return;
        }
        setSaved(true);
      } catch {
        setError("Could not save checklist.");
        setItems(items);
      } finally {
        setSaving(false);
      }
    },
    [bookingId, items],
  );

  const completed = ADMIN_ASSIST_QA_CHECKLIST_KEYS.filter((key) => items[key] === true).length;

  return (
    <section
      className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm"
      data-testid="admin-assisted-qa-checklist-panel"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold text-zinc-900">Dry-run QA checklist</h2>
        <span className="text-xs text-zinc-500">
          {completed}/{ADMIN_ASSIST_QA_CHECKLIST_KEYS.length} complete
        </span>
      </div>
      <p className="mt-1 text-sm text-zinc-600">Optional operator sign-off for pilot dry-runs.</p>
      <ul className="mt-3 space-y-2">
        {ADMIN_ASSIST_QA_CHECKLIST_KEYS.map((key) => (
          <li key={key}>
            <label className="flex cursor-pointer items-start gap-2 text-sm text-zinc-800">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={items[key] === true}
                disabled={saving}
                onChange={() => void onToggle(key)}
                data-testid={`admin-assisted-qa-${key}`}
              />
              <span>{ADMIN_ASSIST_QA_CHECKLIST_LABELS[key]}</span>
            </label>
          </li>
        ))}
      </ul>
      {saved ? <p className="mt-2 text-xs text-emerald-700">Checklist saved.</p> : null}
      {error ? (
        <p className="mt-2 text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}
