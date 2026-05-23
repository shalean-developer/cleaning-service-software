"use client";

import { useState } from "react";
import type { ProductionRolloutChecklistItem } from "@/features/production-rollout/server/productionRolloutTypes";

type Props = {
  item: ProductionRolloutChecklistItem;
};

export function AdminProductionRolloutChecklistItem({ item }: Props) {
  const [completed, setCompleted] = useState(item.completed);
  const [notes, setNotes] = useState(item.notes ?? "");
  const [completedAt, setCompletedAt] = useState(item.completedAt);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(nextCompleted: boolean, nextNotes: string) {
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/production-rollout/checklist/${item.checklistKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completed: nextCompleted, notes: nextNotes || undefined }),
      });
      const body = (await response.json()) as {
        ok: boolean;
        item?: ProductionRolloutChecklistItem;
        message?: string;
      };
      if (!response.ok || !body.ok || !body.item) {
        throw new Error(body.message ?? "Could not save checklist item.");
      }
      setCompleted(body.item.completed);
      setNotes(body.item.notes ?? "");
      setCompletedAt(body.item.completedAt);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <article className="rounded-lg border border-zinc-200 bg-zinc-50/50 p-3">
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={completed}
          disabled={saving}
          onChange={(event) => {
            const next = event.target.checked;
            setCompleted(next);
            void save(next, notes);
          }}
          className="mt-1 h-4 w-4 rounded border-zinc-300"
          aria-label={`Mark ${item.label} complete`}
        />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-zinc-900">{item.label}</p>
          <p className="mt-0.5 font-mono text-xs text-zinc-500">{item.checklistKey}</p>
          {completedAt ? (
            <p className="mt-1 text-xs text-emerald-700">
              Completed {new Date(completedAt).toLocaleString("en-ZA")}
            </p>
          ) : (
            <p className="mt-1 text-xs text-zinc-500">Not completed</p>
          )}
          <label className="mt-2 block text-xs">
            <span className="mb-1 block font-medium text-zinc-500">Notes</span>
            <textarea
              value={notes}
              disabled={saving}
              onChange={(event) => setNotes(event.target.value)}
              onBlur={() => {
                if (notes !== (item.notes ?? "")) void save(completed, notes);
              }}
              rows={2}
              className="w-full rounded-md border border-zinc-300 px-2 py-1 text-sm"
              placeholder="Optional rollout notes"
            />
          </label>
          {error ? <p className="mt-1 text-xs text-red-700">{error}</p> : null}
          {saving ? <p className="mt-1 text-xs text-zinc-500">Saving…</p> : null}
        </div>
      </div>
    </article>
  );
}
