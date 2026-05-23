import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { CustomerPaymentHistoryPanel } from "./CustomerPaymentHistoryPanel";

const fetchMock = vi.fn();

describe("CustomerPaymentHistoryPanel", () => {
  it("renders filters, loading state, and no charge button", () => {
    global.fetch = fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, items: [], nextCursor: null }),
    }) as unknown as typeof fetch;

    const html = renderToStaticMarkup(<CustomerPaymentHistoryPanel />);

    expect(html).toContain("Bookings");
    expect(html).toContain("Invoices");
    expect(html).toContain("Saved-card charges");
    expect(html).toContain("Paid");
    expect(html).toContain("Pending");
    expect(html).toContain("Failed");
    expect(html).toContain("Loading payment history");
    expect(html).not.toContain("Charge");
    expect(html).not.toContain("authorization_code");
  });
});
