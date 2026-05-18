import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import {
  ADMIN_ASSIGNMENT_QUEUE_STRIP_FOOTNOTE_COPY,
  AdminAssignmentQueueStripFootnote,
} from "./AdminAssignmentQueueStripFootnote";

describe("AdminAssignmentQueueStripFootnote (7A-2c)", () => {
  it("renders footnote copy about exact counts vs work queue", () => {
    const html = renderToStaticMarkup(<AdminAssignmentQueueStripFootnote />);
    expect(html).toContain(ADMIN_ASSIGNMENT_QUEUE_STRIP_FOOTNOTE_COPY);
    expect(html).toContain("exact counts across all bookings");
    expect(html).toContain("detailed assignment work queue");
    expect(html).toContain("Assignment attention chip");
  });

  it("is read-only with no mutation controls or links", () => {
    const html = renderToStaticMarkup(<AdminAssignmentQueueStripFootnote />);
    expect(html).not.toContain("<a ");
    expect(html).not.toContain('type="submit"');
    expect(html).not.toContain("<button");
  });
});
