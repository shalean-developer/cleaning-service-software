import { SHALEAN_CONTACT } from "./contact";

export const TERMS_PAGE_PATH = "/terms" as const;
export const PRIVACY_PAGE_PATH = "/privacy" as const;
export const REFUND_POLICY_PAGE_PATH = "/refund-policy" as const;

export const LEGAL_PAGE_PATHS = [
  TERMS_PAGE_PATH,
  PRIVACY_PAGE_PATH,
  REFUND_POLICY_PAGE_PATH,
] as const;

export type LegalPageSlug = "terms" | "privacy" | "refund-policy";

export type LegalPageContent = {
  slug: LegalPageSlug;
  path: string;
  metaTitle: string;
  metaDescription: string;
  h1: string;
  intro: string;
  sections: { heading: string; paragraphs: string[] }[];
};

const contactLine = `Questions? Contact us at ${SHALEAN_CONTACT.email} or ${SHALEAN_CONTACT.phoneDisplay}.`;

export const LEGAL_PAGES: Record<LegalPageSlug, LegalPageContent> = {
  terms: {
    slug: "terms",
    path: TERMS_PAGE_PATH,
    metaTitle: "Terms and Conditions | Shalean",
    metaDescription:
      "Terms and conditions for booking Shalean cleaning services in Cape Town, including bookings, payments, cancellations, and service expectations.",
    h1: "Terms and Conditions",
    intro:
      "These terms apply when you book home or office cleaning with Shalean Cleaning Services in Cape Town.",
    sections: [
      {
        heading: "Bookings and accounts",
        paragraphs: [
          "You must provide accurate contact details, property address, and service requirements when booking online.",
          "A confirmed booking is subject to cleaner availability and the scope selected in your quote.",
        ],
      },
      {
        heading: "Pricing and payment",
        paragraphs: [
          "Quoted prices are based on the service, property size, and add-ons you select. Final charges match the amount shown at checkout unless you change the booking scope.",
          "Payments are processed securely online. Unpaid or expired bookings may be cancelled automatically.",
        ],
      },
      {
        heading: "Access and safety",
        paragraphs: [
          "You are responsible for providing safe access to the property, including keys, codes, parking, and pets where relevant.",
          "Please disclose hazards, fragile items, or special instructions before the clean begins.",
        ],
      },
      {
        heading: "Cancellations and rescheduling",
        paragraphs: [
          "Cancel or reschedule through your account before the cut-off shown at booking. Late cancellations may incur a fee.",
          "If we cannot access the property or the scope differs materially from the booking, we may reschedule or adjust charges after discussion with you.",
        ],
      },
      {
        heading: "Liability",
        paragraphs: [
          "Shalean works with vetted, insured cleaning professionals. Report any service concern promptly so we can review and resolve it fairly.",
          contactLine,
        ],
      },
    ],
  },
  privacy: {
    slug: "privacy",
    path: PRIVACY_PAGE_PATH,
    metaTitle: "Privacy Policy | Shalean",
    metaDescription:
      "How Shalean Cleaning Services collects, uses, and protects personal information when you book cleaning in Cape Town.",
    h1: "Privacy Policy",
    intro:
      "We respect your privacy and only collect information needed to provide cleaning services and support your booking.",
    sections: [
      {
        heading: "Information we collect",
        paragraphs: [
          "We collect details you provide when booking or contacting us, such as name, email, phone number, property address, and service preferences.",
          "Payment processing is handled by our secure payment partners; we do not store full card numbers on our servers.",
        ],
      },
      {
        heading: "How we use information",
        paragraphs: [
          "We use your information to confirm bookings, assign cleaners, send service updates, process payments, and respond to support requests.",
          "We may send transactional messages about your booking. Marketing messages are only sent where permitted and can be opted out.",
        ],
      },
      {
        heading: "Sharing",
        paragraphs: [
          "We share relevant booking details with assigned cleaning professionals and trusted service providers (such as payment processors) solely to deliver the service.",
          "We do not sell your personal information.",
        ],
      },
      {
        heading: "Retention and security",
        paragraphs: [
          "We retain booking and account records as needed for operations, legal compliance, and dispute resolution.",
          "We apply reasonable technical and organisational safeguards to protect your data.",
        ],
      },
      {
        heading: "Your rights",
        paragraphs: [
          "You may request access, correction, or deletion of personal information where applicable law allows. Contact us to make a request.",
          contactLine,
        ],
      },
    ],
  },
  "refund-policy": {
    slug: "refund-policy",
    path: REFUND_POLICY_PAGE_PATH,
    metaTitle: "Refund Policy | Shalean",
    metaDescription:
      "Shalean refund and satisfaction policy for cleaning services in Cape Town, including cancellations, no-shows, and service issues.",
    h1: "Refund Policy",
    intro:
      "We aim for fair, transparent outcomes when a booking is cancelled, disrupted, or does not meet agreed expectations.",
    sections: [
      {
        heading: "Satisfaction guarantee",
        paragraphs: [
          "If something was missed or below the agreed scope, contact us within 24 hours with details. We will review photos or notes and offer a re-clean or credit where appropriate.",
        ],
      },
      {
        heading: "Customer cancellations",
        paragraphs: [
          "Cancel before the cut-off shown in your booking confirmation for a full refund of prepaid amounts where applicable.",
          "Late cancellations or no-access visits may forfeit part or all of the booking fee to cover cleaner allocation.",
        ],
      },
      {
        heading: "Shalean cancellations",
        paragraphs: [
          "If we cancel due to cleaner unavailability or safety concerns, you will receive a full refund or free reschedule.",
        ],
      },
      {
        heading: "Charge disputes",
        paragraphs: [
          "Billing questions should be raised within 7 days of service completion. We will investigate booking records and communicate the outcome clearly.",
          contactLine,
        ],
      },
    ],
  },
};
