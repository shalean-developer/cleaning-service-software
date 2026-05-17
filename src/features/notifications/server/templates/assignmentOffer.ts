export type AssignmentOfferEmailContent = {
  subject: string;
  html: string;
  text: string;
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function buildAssignmentOfferEmail(input: {
  cleanerDisplayName: string | null;
  serviceLabel: string;
  scheduleLabel: string;
  locationLabel: string;
  earningsLabel: string | null;
  expiresAtLabel: string | null;
  offersPageUrl: string;
  supportEmail: string | null;
}): AssignmentOfferEmailContent {
  const greetingName = input.cleanerDisplayName?.trim();
  const greeting = greetingName ? `Hi ${greetingName},` : "Hi there,";

  const supportLine = input.supportEmail
    ? `If you need help, contact us at ${input.supportEmail}.`
    : "If you need help, reply to this email or contact Shalean support.";

  const detailLines = [
    `Service: ${input.serviceLabel}`,
    `When: ${input.scheduleLabel}`,
    `Area: ${input.locationLabel}`,
  ];

  if (input.earningsLabel) {
    detailLines.push(`Estimated earnings: ${input.earningsLabel}`);
  } else {
    detailLines.push("Earnings: shown in your cleaner dashboard");
  }

  if (input.expiresAtLabel) {
    detailLines.push(`Offer expires: ${input.expiresAtLabel}`);
  }

  const text = [
    greeting,
    "",
    "You have a new Shalean cleaning job offer.",
    "",
    ...detailLines,
    "",
    "Please accept or decline from your cleaner dashboard.",
    "",
    `View offers: ${input.offersPageUrl}`,
    "",
    supportLine,
    "",
    "You received this because you are a registered Shalean cleaner.",
  ].join("\n");

  const earningsHtml = input.earningsLabel
    ? `<li><strong>Estimated earnings:</strong> ${escapeHtml(input.earningsLabel)}</li>`
    : `<li><strong>Earnings:</strong> shown in your cleaner dashboard</li>`;

  const expiryHtml = input.expiresAtLabel
    ? `<li><strong>Offer expires:</strong> ${escapeHtml(input.expiresAtLabel)}</li>`
    : "";

  const html = `<!DOCTYPE html>
<html lang="en">
<body style="font-family: system-ui, sans-serif; line-height: 1.5; color: #111;">
  <p>${escapeHtml(greeting)}</p>
  <p><strong>You have a new Shalean cleaning job offer.</strong></p>
  <ul>
    <li><strong>Service:</strong> ${escapeHtml(input.serviceLabel)}</li>
    <li><strong>When:</strong> ${escapeHtml(input.scheduleLabel)}</li>
    <li><strong>Area:</strong> ${escapeHtml(input.locationLabel)}</li>
    ${earningsHtml}
    ${expiryHtml}
  </ul>
  <p>Please accept or decline from your cleaner dashboard.</p>
  <p><a href="${escapeHtml(input.offersPageUrl)}">View offers</a></p>
  <p style="color: #555; font-size: 14px;">${escapeHtml(supportLine)}</p>
  <p style="color: #555; font-size: 14px;">You received this because you are a registered Shalean cleaner.</p>
</body>
</html>`;

  return {
    subject: "New Shalean cleaning job offer",
    html,
    text,
  };
}
