import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CustomerPaymentMethodsPanel } from "./CustomerPaymentMethodsPanel";

describe("CustomerPaymentMethodsPanel", () => {
  it("renders title and no charge button", () => {
    const html = renderToStaticMarkup(<CustomerPaymentMethodsPanel />);
    expect(html).toContain("Loading saved payment methods");
    expect(html).not.toContain("Charge");
    expect(html).not.toContain("authorization_code");
  });
});
