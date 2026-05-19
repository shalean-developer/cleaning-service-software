import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { CleanerEarningsListCard } from "./CleanerEarningsListCard";

describe("CleanerEarningsListCard", () => {
  it("renders amount-first hierarchy with payout status and job link", () => {
    const html = renderToStaticMarkup(
      <CleanerEarningsListCard
        item={{
          id: "earn-1",
          serviceLabel: "Deep clean",
          scheduleLabel: "Mon, 12 May, 09:00",
          payoutAmountCents: 35_000,
          payoutStatus: "pending",
          bookingId: "booking-1",
        }}
      />,
    );

    expect(html).toContain("Deep clean");
    expect(html).toContain("Pending payout");
    expect(html).toContain("R");
    expect(html).toContain("350");
    expect(html).toContain("/cleaner/jobs/booking-1");
    expect(html).toContain("View job");
  });
});
