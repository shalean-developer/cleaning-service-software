import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AdminZohoLaunchStatusPanel } from "./AdminZohoLaunchStatusPanel";

describe("AdminZohoLaunchStatusPanel", () => {
  it("renders feature flags and readiness without exposing secrets", () => {
    const html = renderToStaticMarkup(
      <AdminZohoLaunchStatusPanel
        featureState={{
          invoicePaymentsEnabled: true,
          savedMethodsEnabled: false,
          adminCardChargesEnabled: false,
          zohoConfigured: true,
          paystackEnabled: true,
          paystackMode: "test",
          cronSecretConfigured: true,
          paystackWebhookConfigured: false,
        }}
        lastCronRun={{
          jobName: "reconcile-zoho-invoice-payments",
          status: "completed",
          startedAt: "2026-05-22T08:00:00.000Z",
          completedAt: "2026-05-22T08:00:05.000Z",
        }}
      />,
    );

    expect(html).toContain("Launch status");
    expect(html).toContain("Invoice payments: Enabled");
    expect(html).toContain("Saved methods: Disabled");
    expect(html).toContain("Admin card charges: Disabled");
    expect(html).toContain("Test");
    expect(html).not.toContain("sk_");
    expect(html).not.toContain("authorization_code");
  });
});
