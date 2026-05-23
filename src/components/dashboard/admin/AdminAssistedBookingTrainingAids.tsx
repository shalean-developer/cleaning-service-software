import { ADMIN_ASSISTED_TRAINING_AIDS } from "@/features/bookings/server/admin/adminAssistedTrainingAids";

type Props = {
  compact?: boolean;
};

export function AdminAssistedBookingTrainingAids({ compact = false }: Props) {
  return (
    <section
      className={`rounded-xl border border-sky-200 bg-sky-50/50 ${compact ? "p-3" : "p-4"}`}
      data-testid="admin-assisted-training-aids"
    >
      <h2 className={`font-semibold text-sky-950 ${compact ? "text-sm" : "text-base"}`}>
        Operator guidance
      </h2>
      {!compact ? (
        <p className="mt-1 text-sm text-sky-900/80">
          Quick reminders for admin-assisted booking pilot operations.
        </p>
      ) : null}
      <ul className={`mt-2 space-y-1.5 ${compact ? "text-xs" : "text-sm"} text-sky-900`}>
        {ADMIN_ASSISTED_TRAINING_AIDS.map((aid) => (
          <li key={aid.id} className="flex gap-2">
            <span aria-hidden className="text-sky-600">
              •
            </span>
            <span>{aid.text}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
