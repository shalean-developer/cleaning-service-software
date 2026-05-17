import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { AdminNotificationDeliveryBanner } from "./AdminNotificationDeliveryBanner";
import type { AdminNotificationDeliveryBannerModel } from "@/features/notifications/server/notificationAdminTypes";

const baseBanner: AdminNotificationDeliveryBannerModel = {
  deliveryEnabled: true,
  canRunDelivery: true,
  emailProvider: "resend",
  appBaseUrl: "https://app.example.com",
  appBaseUrlWarning: null,
  staleProcessingMinutes: 15,
};

describe("AdminNotificationDeliveryBanner", () => {
  it("renders emphasized localhost warning when appBaseUrlWarning is set", () => {
    const html = renderToStaticMarkup(
      <AdminNotificationDeliveryBanner
        banner={{
          ...baseBanner,
          appBaseUrl: "http://localhost:3000",
          appBaseUrlWarning:
            "APP_BASE_URL resolves to localhost — email links may be wrong in production.",
        }}
      />,
    );
    expect(html).toContain("APP_BASE_URL resolves to localhost.");
    expect(html).toContain(
      "Notification links may be incorrect outside local development.",
    );
    expect(html).toContain("border-amber-400");
    expect(html).toContain('role="status"');
  });

  it("does not render localhost warning surface when warning is absent", () => {
    const html = renderToStaticMarkup(<AdminNotificationDeliveryBanner banner={baseBanner} />);
    expect(html).not.toContain("APP_BASE_URL resolves to localhost.");
    expect(html).not.toContain("border-amber-400 bg-amber-100");
  });
});
