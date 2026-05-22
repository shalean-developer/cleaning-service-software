"use client";

type Props = {
  showResponse: boolean;
  customerResponse: string;
  adminNotes: string;
  onCustomerResponseChange: (value: string) => void;
  onAdminNotesChange: (value: string) => void;
};

export function AdminSupportRequestResponseFields({
  showResponse,
  customerResponse,
  adminNotes,
  onCustomerResponseChange,
  onAdminNotesChange,
}: Props) {
  if (!showResponse) return null;

  return (
    <div className="mt-3 space-y-2 border-t border-amber-200/60 pt-3">
      <label className="block text-xs font-medium text-amber-950">
        Customer-visible response (optional)
        <textarea
          value={customerResponse}
          onChange={(e) => onCustomerResponseChange(e.target.value)}
          rows={2}
          placeholder="Short note the customer will see on their request…"
          className="mt-1 w-full rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm text-zinc-800"
        />
      </label>
      <label className="block text-xs font-medium text-zinc-600">
        Internal admin notes (optional, not shown to customer)
        <textarea
          value={adminNotes}
          onChange={(e) => onAdminNotesChange(e.target.value)}
          rows={2}
          placeholder="Internal only…"
          className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-700"
        />
      </label>
    </div>
  );
}
