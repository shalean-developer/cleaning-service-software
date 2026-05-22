import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { CustomerSupportRequestTimeline } from "./CustomerSupportRequestTimeline";

describe("CustomerSupportRequestTimeline", () => {
  it("renders timeline and cancellation warning", () => {
    const html = renderToStaticMarkup(
      <CustomerSupportRequestTimeline
        requests={[
          {
            id: "r1",
            requestType: "cancel",
            requestTypeLabel: "Request cancellation",
            status: "open",
            statusLabel: "Open",
            message: "Please cancel",
            customerResponse: null,
            createdAt: "2026-05-20T10:00:00.000Z",
            statusChangedAt: "2026-05-20T10:00:00.000Z",
            resolvedAt: null,
          },
        ]}
        contactHref="/contact"
      />,
    );
    expect(html).toContain("does not change your booking");
    expect(html).toContain("does not automatically cancel");
    expect(html).toContain("Contact support");
  });

  it("shows team response when present", () => {
    const html = renderToStaticMarkup(
      <CustomerSupportRequestTimeline
        requests={[
          {
            id: "r2",
            requestType: "general_message",
            requestTypeLabel: "Message",
            status: "resolved",
            statusLabel: "Resolved",
            message: "Hi",
            customerResponse: "We will call you today.",
            createdAt: "2026-05-20T10:00:00.000Z",
            statusChangedAt: "2026-05-21T10:00:00.000Z",
            resolvedAt: "2026-05-21T10:00:00.000Z",
          },
        ]}
      />,
    );
    expect(html).toContain("Team response:");
    expect(html).toContain("We will call you today.");
  });
});
