import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { buildSupportNotificationEmailFromPayload } from "./buildSupportNotificationEmailFromPayload";
import {
  assertNoMisleadingBookingMutationCopy,
  FORBIDDEN_SUPPORT_CUSTOMER_PHRASES,
} from "./supportNotificationTemplates";
import { SUPPORT_NOTIFICATION_RENDER_FIXTURES } from "./supportNotificationRenderFixtures";
import { isAdminUrgentSupportPayload } from "./parseSupportOutboxPayload";

export type SupportNotificationRenderPreviewResult = {
  template: string;
  subject: string;
  textPreview: string;
  ok: boolean;
  errors: string[];
};

function textPreview(text: string, maxLen = 400): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  return normalized.length <= maxLen ? normalized : `${normalized.slice(0, maxLen)}…`;
}

export function renderAllSupportNotificationPreviews(): SupportNotificationRenderPreviewResult[] {
  return SUPPORT_NOTIFICATION_RENDER_FIXTURES.map((fixture) => {
    const errors: string[] = [];
    const content = buildSupportNotificationEmailFromPayload(fixture);

    if (!content) {
      return {
        template: fixture.template,
        subject: "(render failed)",
        textPreview: "",
        ok: false,
        errors: ["buildSupportNotificationEmailFromPayload returned null"],
      };
    }

    if (!isAdminUrgentSupportPayload(fixture)) {
      if (!assertNoMisleadingBookingMutationCopy(content.text)) {
        errors.push("forbidden booking mutation copy in text");
      }
      if (!assertNoMisleadingBookingMutationCopy(content.html)) {
        errors.push("forbidden booking mutation copy in html");
      }
      for (const phrase of FORBIDDEN_SUPPORT_CUSTOMER_PHRASES) {
        if (content.text.toLowerCase().includes(phrase) || content.html.toLowerCase().includes(phrase)) {
          errors.push(`forbidden phrase: ${phrase}`);
        }
      }
      if (!content.text.includes("support request status only")) {
        errors.push("missing booking safety disclaimer");
      }
    }

    if (
      fixture.customerResponse &&
      !content.text.includes(fixture.customerResponse)
    ) {
      errors.push("customer_response missing from output");
    }

    return {
      template: fixture.template,
      subject: content.subject,
      textPreview: textPreview(content.text),
      ok: errors.length === 0,
      errors,
    };
  });
}

export function printSupportNotificationRenderPreviews(): {
  ok: boolean;
  results: SupportNotificationRenderPreviewResult[];
} {
  const results = renderAllSupportNotificationPreviews();

  for (const row of results) {
    console.log(`\n--- ${row.template} ---`);
    console.log(`Subject: ${row.subject}`);
    console.log(`Preview: ${row.textPreview}`);
    if (row.errors.length) {
      console.log(`Errors: ${row.errors.join("; ")}`);
    }
  }

  const ok = results.every((r) => r.ok);
  console.log(`\n${ok ? "PASS" : "FAIL"}: ${results.length} support notification templates rendered`);
  return { ok, results };
}

export function writeSupportNotificationPreviewsToDir(dir: string): void {
  mkdirSync(dir, { recursive: true });
  const results = renderAllSupportNotificationPreviews();

  for (const fixture of SUPPORT_NOTIFICATION_RENDER_FIXTURES) {
    const content = buildSupportNotificationEmailFromPayload(fixture);
    if (!content) continue;
    const base = join(dir, fixture.template);
    writeFileSync(`${base}.subject.txt`, content.subject, "utf8");
    writeFileSync(`${base}.text.txt`, content.text, "utf8");
    writeFileSync(`${base}.html.txt`, content.html, "utf8");
  }

  writeFileSync(join(dir, "summary.json"), JSON.stringify(results, null, 2), "utf8");
}
