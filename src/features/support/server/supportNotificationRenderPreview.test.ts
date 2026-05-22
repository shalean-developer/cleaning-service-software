import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { join } from "node:path";
import {
  printSupportNotificationRenderPreviews,
  renderAllSupportNotificationPreviews,
  writeSupportNotificationPreviewsToDir,
} from "./supportNotificationRenderPreview";

describe("supportNotificationRenderPreview", () => {
  it("renders all support templates with safe copy", () => {
    process.env.APP_BASE_URL = "https://app.example.com";
    const { ok, results } = printSupportNotificationRenderPreviews();
    expect(results).toHaveLength(5);
    expect(results.map((r) => r.subject).every((s) => s.length > 5)).toBe(true);
    expect(ok).toBe(true);
  });

  it("writes preview files to tmp when WRITE_SUPPORT_PREVIEWS=1", () => {
    if (process.env.WRITE_SUPPORT_PREVIEWS !== "1") {
      return;
    }
    const dir = join(process.cwd(), "tmp/support-notification-previews");
    writeSupportNotificationPreviewsToDir(dir);
    expect(existsSync(join(dir, "support_request_created.text.txt"))).toBe(true);
    expect(existsSync(join(dir, "summary.json"))).toBe(true);
  });

  it("includes Shalean subjects for customer events", () => {
    process.env.APP_BASE_URL = "https://app.example.com";
    const results = renderAllSupportNotificationPreviews();
    const created = results.find((r) => r.template === "support_request_created");
    expect(created?.subject).toBe("We received your Shalean support request");
    const admin = results.find((r) => r.template === "support_request_admin_urgent");
    expect(admin?.subject).toBe("Urgent Shalean support request");
  });
});
