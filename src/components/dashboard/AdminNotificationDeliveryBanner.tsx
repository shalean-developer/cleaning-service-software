import type { AdminNotificationDeliveryBannerModel } from "@/features/notifications/server/notificationAdminTypes";

type Props = {
  banner: AdminNotificationDeliveryBannerModel;
};

export function AdminNotificationDeliveryBanner({ banner }: Props) {
  const deliveryTone = banner.deliveryEnabled
    ? banner.canRunDelivery
      ? "border-emerald-200 bg-emerald-50 text-emerald-950"
      : "border-amber-200 bg-amber-50 text-amber-950"
    : "border-zinc-200 bg-zinc-50 text-zinc-800";

  return (
    <section className={`rounded-xl border px-4 py-3 text-sm ${deliveryTone}`}>
      <p className="font-medium">Delivery configuration</p>
      <ul className="mt-2 list-inside list-disc space-y-1 text-xs sm:text-sm">
        <li>
          ENABLE_NOTIFICATION_DELIVERY:{" "}
          <strong>{banner.deliveryEnabled ? "on" : "off"}</strong>
          {!banner.deliveryEnabled ? " — cron worker will no-op." : null}
        </li>
        <li>
          Provider: <strong>{banner.emailProvider}</strong>
          {banner.deliveryEnabled && !banner.canRunDelivery
            ? " — provider not ready (check Resend env)."
            : null}
        </li>
        <li>
          APP_BASE_URL: <span className="font-mono">{banner.appBaseUrl}</span>
        </li>
        <li>
          Stale processing reclaim after <strong>{banner.staleProcessingMinutes}m</strong>{" "}
          (claim age).
        </li>
      </ul>
      {banner.appBaseUrlWarning ? (
        <p className="mt-2 text-xs font-medium text-amber-900">{banner.appBaseUrlWarning}</p>
      ) : null}
      <p className="mt-3 text-xs text-zinc-600">
        This page is read-only. Use the notification cron and{" "}
        <span className="font-mono">docs/operations/notification-outbox-worker.md</span> for
        processing — no retry or resend from the dashboard.
      </p>
    </section>
  );
}
