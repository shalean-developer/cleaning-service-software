import { describe, expect, it } from "vitest";

describe("admin customer API mutation surface", () => {
  it("does not add timeline mutation routes under customers", async () => {
    const listRoute = await import("./route");
    const detailRoute = await import("./[customerId]/route");

    expect("DELETE" in listRoute).toBe(false);
    expect("DELETE" in detailRoute).toBe(false);
    expect("PUT" in listRoute).toBe(false);
    expect("PUT" in detailRoute).toBe(false);
  });
});
