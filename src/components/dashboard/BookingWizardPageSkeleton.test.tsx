import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { BookingWizardPageSkeleton } from "./BookingWizardPageSkeleton";

describe("BookingWizardPageSkeleton", () => {
  it("renders accessible loading state with wizard shell", () => {
    const html = renderToStaticMarkup(<BookingWizardPageSkeleton />);
    expect(html).toContain('role="status"');
    expect(html).toContain("Loading");
    expect(html).toContain("max-w-3xl");
  });
});
