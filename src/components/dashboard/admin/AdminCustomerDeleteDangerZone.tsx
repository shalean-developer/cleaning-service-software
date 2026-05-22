"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  ARCHIVE_CUSTOMER_CONFIRM_PHRASE,
  assessCustomerArchiveEligibility,
  CUSTOMER_HARD_DELETE_CONFIRM_PHRASE,
} from "@/features/admin/adminEntityArchiveEligibility";
import { ADMIN_ACTION_ERROR_CLASS } from "@/lib/app/dashboardEcosystemDisplay";

type Props = {
  customerId: string;
  deletedAt: string | null;
  archivedAtLabel?: string | null;
  bookingCount: number;
  paidPaymentCount: number;
};

export function AdminCustomerDeleteDangerZone({
  customerId,
  deletedAt,
  archivedAtLabel,
  bookingCount,
  paidPaymentCount,
}: Props) {
  const router = useRouter();
  const [openMode, setOpenMode] = useState<"archive" | "hard_delete" | null>(null);
  const [reason, setReason] = useState("");
  const [typedConfirm, setTypedConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const eligibility = assessCustomerArchiveEligibility({
    deletedAt,
    bookingCount,
    paidPaymentCount,
  });

  const isArchived = eligibility.isArchived;
  const confirmPhrase =
    openMode === "hard_delete" ? CUSTOMER_HARD_DELETE_CONFIRM_PHRASE : ARCHIVE_CUSTOMER_CONFIRM_PHRASE;

  const hardDeleteDisabledReason = !eligibility.canHardDelete
    ? eligibility.hardDeleteBlockedMessage
    : null;

  async function submit() {
    if (!openMode) return;
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch(`/api/admin/customers/${customerId}/archive`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reason,
          confirmPhrase: typedConfirm,
          action: openMode === "hard_delete" ? "delete" : "archive",
        }),
      });
      const result = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        message?: string;
        error?: string;
        blockedReason?: string;
      };

      if (!response.ok || !result.ok) {
        setError(
          result.message ??
            result.blockedReason ??
            result.error ??
            "Action failed.",
        );
        return;
      }

      setMessage(result.message ?? "Done.");
      setOpenMode(null);
      setReason("");
      setTypedConfirm("");
      if (openMode === "hard_delete") {
        router.push("/admin/customers");
      } else {
        router.refresh();
      }
    } catch {
      setError("Network error. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section
      className={
        isArchived
          ? "rounded-lg border border-zinc-200 bg-zinc-50 p-4"
          : "rounded-lg border border-red-200 bg-red-50/40 p-4"
      }
    >
      <h2
        className={
          isArchived ? "text-sm font-semibold text-zinc-900" : "text-sm font-semibold text-red-950"
        }
      >
        Danger zone
      </h2>
      {isArchived ? (
        <p className="mt-2 text-sm text-zinc-600">
          This customer was archived on {archivedAtLabel ?? deletedAt}. Archive hides the profile
          from admin lists while preserving bookings and payments. Permanent delete removes the
          customer row only when there is no booking or payment history.
        </p>
      ) : (
        <p className="mt-1 text-sm text-red-900/90">
          Archive hides this customer from admin lists while preserving all bookings, payments, and
          audit history. Permanent delete removes test or duplicate profiles with no bookings or
          payments — it cannot be undone.
        </p>
      )}
      {message ? <p className="mt-2 text-sm text-emerald-800">{message}</p> : null}
      {error && !openMode ? <p className={`mt-2 ${ADMIN_ACTION_ERROR_CLASS}`}>{error}</p> : null}

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        {!isArchived ? (
          <div className="min-w-0 flex-1">
            <button
              type="button"
              className="w-full rounded-lg border border-red-300 bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={loading || !eligibility.canArchive}
              onClick={() => {
                setOpenMode("archive");
                setError(null);
                setTypedConfirm("");
              }}
            >
              Archive customer
            </button>
          </div>
        ) : null}

        <div className={isArchived ? "min-w-0 max-w-md" : "min-w-0 flex-1"}>
          <button
            type="button"
            className="w-full rounded-lg border border-red-500 bg-white px-3 py-2 text-sm font-medium text-red-950 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={loading || !eligibility.canHardDelete}
            title={hardDeleteDisabledReason ?? undefined}
            onClick={() => {
              setOpenMode("hard_delete");
              setError(null);
              setTypedConfirm("");
            }}
          >
            Permanently delete customer
          </button>
          {hardDeleteDisabledReason ? (
            <p className="mt-1 text-xs text-zinc-700">{hardDeleteDisabledReason}</p>
          ) : (
            <p className="mt-1 text-xs text-zinc-600">
              Only for profiles with no bookings or paid payments.
            </p>
          )}
        </div>
      </div>

      {openMode ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="admin-customer-delete-dialog-title"
        >
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl bg-white p-5 shadow-xl">
            <h3
              id="admin-customer-delete-dialog-title"
              className="text-base font-semibold text-zinc-900"
            >
              {openMode === "hard_delete" ? "Permanently delete customer" : "Archive customer"}
            </h3>
            <p className="mt-2 text-sm text-zinc-600">
              {openMode === "hard_delete"
                ? "This permanently removes the customer profile row. The auth account is not deleted. Use only when there are no bookings or payments."
                : "Archives this customer for admin views. All bookings, payments, and audit history remain in the database."}
            </p>
            <p className="mt-2 text-xs text-zinc-500">Customer ID: {customerId}</p>

            <label className="mt-4 block text-sm">
              <span className="font-medium text-zinc-800">Reason (required)</span>
              <textarea
                className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                disabled={loading}
              />
            </label>

            <label className="mt-3 block text-sm">
              <span className="font-medium text-zinc-800">
                Type <span className="font-mono text-red-800">{confirmPhrase}</span> to confirm
              </span>
              <input
                type="text"
                className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 font-mono text-sm"
                value={typedConfirm}
                onChange={(e) => setTypedConfirm(e.target.value)}
                disabled={loading}
                autoComplete="off"
              />
            </label>

            {error ? <p className={`mt-3 ${ADMIN_ACTION_ERROR_CLASS}`}>{error}</p> : null}

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-lg border border-zinc-200 px-3 py-2 text-sm font-medium text-zinc-800"
                disabled={loading}
                onClick={() => setOpenMode(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
                disabled={loading || !reason.trim() || typedConfirm !== confirmPhrase}
                onClick={() => void submit()}
              >
                {loading
                  ? "Working…"
                  : openMode === "hard_delete"
                    ? "Confirm permanent delete"
                    : "Confirm archive"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
