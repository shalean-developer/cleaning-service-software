import type { AdminBookingFlowProgress } from "../adminBookingFlowState";

type ChecklistItem = {
  key: keyof AdminBookingFlowProgress;
  label: string;
};

export const ADMIN_BOOKING_FLOW_CHECKLIST: ChecklistItem[] = [
  { key: "draftSaved", label: "Draft saved" },
  { key: "pendingPaymentCreated", label: "Pending payment created" },
  { key: "paymentLinkGenerated", label: "Payment link generated" },
  { key: "emailRequestSent", label: "Email request sent" },
  { key: "whatsappCopied", label: "WhatsApp message copied" },
  { key: "offlinePaymentRecorded", label: "Offline payment recorded" },
  { key: "bookingConfirmed", label: "Booking confirmed" },
];

type Props = {
  progress: AdminBookingFlowProgress;
  serverStatusLabel?: string | null;
};

export function AdminBookingWizardConfirmationChecklist({ progress, serverStatusLabel }: Props) {
  return (
    <section
      className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3"
      data-testid="admin-booking-flow-checklist"
      aria-label="Booking progress checklist"
    >
      <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Progress</h3>
      {serverStatusLabel ? (
        <p className="mt-1 text-xs text-slate-600" data-testid="admin-booking-checklist-server-status">
          Current booking status: <span className="font-medium capitalize">{serverStatusLabel}</span>
        </p>
      ) : null}
      <ul className="mt-2 space-y-1.5">
        {ADMIN_BOOKING_FLOW_CHECKLIST.map((item) => {
          const done = progress[item.key];
          return (
            <li
              key={item.key}
              className="flex items-center gap-2 text-sm"
              data-testid={`admin-booking-checklist-${item.key}`}
              data-done={done ? "true" : "false"}
            >
              <span
                className={`inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                  done ? "bg-emerald-600 text-white" : "border border-slate-300 bg-white text-slate-400"
                }`}
                aria-hidden
              >
                {done ? "✓" : ""}
              </span>
              <span className={done ? "text-slate-900" : "text-slate-500"}>{item.label}</span>
            </li>
          );
        })}
      </ul>
      {!progress.bookingConfirmed && progress.paymentLinkGenerated ? (
        <p className="mt-2 text-xs text-slate-600" data-testid="admin-booking-waiting-payment">
          Waiting for customer payment confirmation. Assignment begins after confirmation.
        </p>
      ) : null}
    </section>
  );
}
