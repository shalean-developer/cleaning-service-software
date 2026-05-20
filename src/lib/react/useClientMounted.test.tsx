import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { useClientMounted } from "./useClientMounted";

function MountedProbe() {
  const mounted = useClientMounted();
  return <span data-mounted={mounted ? "true" : "false"} />;
}

describe("useClientMounted", () => {
  it("returns false during server render (hydration-safe default)", () => {
    const html = renderToStaticMarkup(<MountedProbe />);
    expect(html).toContain('data-mounted="false"');
  });
});
