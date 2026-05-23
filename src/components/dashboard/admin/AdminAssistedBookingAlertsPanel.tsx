import type {
  AdminAssistedBookingAlert,
  AdminAssistedBookingAlertSeverity,
} from "@/features/bookings/server/admin/adminAssistedBookingAlerts";

type Props = {
  alerts: AdminAssistedBookingAlert[];
};

const SEVERITY_STYLES: Record<AdminAssistedBookingAlertSeverity, string> = {
  critical: "border-red-200 bg-red-50 text-red-950",
  high: "border-orange-200 bg-orange-50 text-orange-950",
  warning: "border-amber-200 bg-amber-50 text-amber-950",
  info: "border-sky-200 bg-sky-50 text-sky-950",
};

const SEVERITY_LABEL: Record<AdminAssistedBookingAlertSeverity, string> = {
  critical: "Critical",
  high: "High",
  warning: "Warning",
  info: "Info",
};

export function AdminAssistedBookingAlertsPanel({ alerts }: Props) {
  if (alerts.length === 0) {
    return (
      <section
        className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4 text-sm text-emerald-900"
        data-testid="admin-assisted-alerts-panel-empty"
      >
        <p className="font-medium">No active operational alerts</p>
        <p className="mt-1 text-xs">
          Fleet metrics are within expected thresholds for the scanned window.
        </p>
      </section>
    );
  }

  return (
    <section
      className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm"
      data-testid="admin-assisted-alerts-panel"
    >
      <h2 className="text-base font-semibold text-zinc-900">Operational alerts</h2>
      <p className="mt-1 text-sm text-zinc-600">Read-only escalation signals — no auto-repair.</p>
      <ul className="mt-4 space-y-3">
        {alerts.map((alert) => (
          <li
            key={alert.id}
            className={`rounded-lg border p-3 ${SEVERITY_STYLES[alert.severity]}`}
            data-testid={`admin-assisted-alert-${alert.id}`}
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-white/70 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
                {SEVERITY_LABEL[alert.severity]}
              </span>
              <p className="font-medium">{alert.title}</p>
              {alert.count > 0 ? (
                <span className="text-xs tabular-nums opacity-80">({alert.count})</span>
              ) : null}
            </div>
            <p className="mt-1 text-sm">{alert.message}</p>
            <p className="mt-2 text-xs opacity-90">
              <span className="font-medium">Escalation:</span> {alert.escalation}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
