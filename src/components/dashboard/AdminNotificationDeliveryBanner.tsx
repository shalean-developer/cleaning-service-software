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
          Email provider: <strong>{banner.emailProvider}</strong>
          {banner.emailProvider === "resend" ? (
            <span>
              {" "}
              (Resend only —{" "}
              <strong>{banner.resendConfigured ? "configured" : "not configured"}</strong>)
            </span>
          ) : null}
          {banner.deliveryEnabled && !banner.canRunDelivery && banner.emailProvider === "resend"
            ? " — cannot send until Resend env is set."
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
      {banner.readinessHint ? (
        <p className="mt-2 text-xs text-zinc-700">{banner.readinessHint}</p>
      ) : null}
      {banner.appBaseUrlWarning ? (
        <div
          className="mt-3 flex gap-2.5 rounded-lg border border-amber-400 bg-amber-100 px-3 py-2.5 text-amber-950"
          role="status"
        >
          <span
            className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-amber-600 bg-amber-200 text-[11px] font-bold leading-none"
            aria-hidden
          >
            !
          </span>
          <div className="min-w-0 space-y-0.5">
            <p className="text-sm font-semibold leading-snug">
              APP_BASE_URL resolves to localhost.
            </p>
            <p className="text-xs leading-relaxed text-amber-900/90">
              Notification links may be incorrect outside local development.
            </p>
          </div>
        </div>
      ) : null}
      <p className="mt-3 text-xs text-zinc-600">
        This page is read-only. Use the notification cron and{" "}
        <span className="font-mono">docs/operations/notification-outbox-worker.md</span> for
        processing — no retry or resend from the dashboard.
      </p>
    </section>
  );
}
