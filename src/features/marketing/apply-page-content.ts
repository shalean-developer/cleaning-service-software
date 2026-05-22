import { APPLY_PATH, CLEANER_SIGN_IN_PATH } from "./constants";
import { APPLY_FORM_PAGE_PATH } from "./marketing-routes";

export const APPLY_PAGE_PATH = APPLY_PATH;
export { APPLY_FORM_PAGE_PATH };

export const APPLY_PAGE_META = {
  title: "Apply to Work with Shalean | Cleaner Opportunities in Cape Town",
  description:
    "Apply to become a cleaner with Shalean in Cape Town. Flexible recurring cleaning opportunities, operational support, and secure online onboarding.",
  keywords: [
    "apply to work with Shalean",
    "cleaner opportunities Cape Town",
    "cleaning jobs Cape Town",
    "work with Shalean",
  ],
} as const;

export const APPLY_PAGE_H1 = "Apply to clean with Shalean";

export const APPLY_HERO = {
  subtitle:
    "Join a trusted Cape Town cleaning platform offering recurring home cleaning, Airbnb turnovers, deep cleaning, and office cleaning opportunities.",
  benefits: [
    "Flexible work opportunities",
    "Choose your availability",
    "Recurring customer schedules",
    "Operational support from Shalean",
  ] as const,
  primaryCta: "Start application",
  primaryHref: APPLY_FORM_PAGE_PATH,
  secondaryCta: "Cleaner sign in",
  secondaryHref: CLEANER_SIGN_IN_PATH,
  image:
    "https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=1200&q=85",
  imageAlt: "Professional Shalean cleaning team member in a modern home",
} as const;

export const APPLY_TRUST_STRIP = [
  "Serving Cape Town homes",
  "Recurring cleaning opportunities",
  "Operational support team",
  "Secure online onboarding",
] as const;

export const APPLY_WORK_TYPE_CARDS = [
  {
    id: "home",
    title: "Home cleaning",
    description: "Regular and once-off home cleans across Cape Town suburbs.",
    tasks: ["Kitchens & bathrooms", "Living areas", "Client-ready finish"],
    tags: ["Regular", "Residential"],
    icon: "home" as const,
  },
  {
    id: "deep",
    title: "Deep cleaning",
    description: "Intensive top-to-bottom refreshes for seasonal or move-related cleans.",
    tasks: ["Detailed surfaces", "Appliances", "Neglected areas"],
    tags: ["Deep", "Intensive"],
    icon: "sparkles" as const,
  },
  {
    id: "airbnb",
    title: "Airbnb turnovers",
    description: "Guest-ready turnovers between stays with checklist discipline.",
    tasks: ["Linens & staging", "Quick turnaround", "Host standards"],
    tags: ["Short-stay", "Turnover"],
    icon: "key" as const,
  },
  {
    id: "office",
    title: "Office cleaning",
    description: "Professional workspace cleaning for offices and studios.",
    tasks: ["Desks & common areas", "Restrooms", "After-hours slots"],
    tags: ["Commercial", "Office"],
    icon: "building" as const,
  },
  {
    id: "recurring",
    title: "Recurring schedules",
    description: "Weekly, bi-weekly, or monthly routes when clients confirm recurring care.",
    tasks: ["Predictable visits", "Same-client rapport", "Route planning"],
    tags: ["Weekly", "Recurring"],
    icon: "calendar" as const,
  },
] as const;

export const APPLY_PROCESS_STEPS = [
  {
    step: 1,
    title: "Submit application",
    description: "Complete the short multi-step form — no account required.",
  },
  {
    step: 2,
    title: "Team review",
    description: "Our operations team reviews your profile and may contact you.",
  },
  {
    step: 3,
    title: "Complete onboarding",
    description: "Approved cleaners finish onboarding before receiving offers.",
  },
  {
    step: 4,
    title: "Receive opportunities",
    description: "Once eligible, accept booking offers that match your profile.",
  },
] as const;

export const APPLY_PROCESS_NOTE =
  "Applications are reviewed before activation. Shalean does not create active cleaner accounts automatically.";

export const APPLY_REQUIREMENTS = [
  "Smartphone access for offers and communication",
  "Reliable communication with Shalean and customers",
  "Cleaning experience preferred (not always required)",
  "Ability to travel to customer homes in your chosen areas",
  "Professional conduct in homes and workplaces",
  "Legal right to work in South Africa",
] as const;

export const APPLY_REQUIREMENTS_NOTE =
  "ID verification, banking, and other sensitive documents are collected later during onboarding — not on this application form.";

export const APPLY_PAGE_FAQ = [
  {
    question: "Do I need an account to apply?",
    answer:
      "No. Use Start application to open our short application form. If approved, we help you set up a cleaner account during onboarding.",
  },
  {
    question: "How long does review take?",
    answer:
      "Review times vary. We contact shortlisted applicants. Duplicate submissions with the same phone may be flagged.",
  },
  {
    question: "Are jobs guaranteed?",
    answer:
      "No. Approval and onboarding make you eligible for offers; actual work depends on demand, your areas, and availability.",
  },
  {
    question: "I already work with Shalean — where do I sign in?",
    answer: "Use Cleaner sign in for your dashboard. This page is for new applicants only.",
  },
] as const;

export const APPLY_LANDING_CTA = {
  eyebrow: "Ready to apply?",
  title: "Start your cleaner application",
  subtitle:
    "Four short steps on our application form. Your progress is saved automatically on this device.",
  href: APPLY_FORM_PAGE_PATH,
  label: "Start application",
} as const;

export const APPLY_FORM_PAGE_META = {
  title: "Cleaner application | Shalean",
  description:
    "Complete your Shalean cleaner application. Our team reviews every submission before onboarding.",
} as const;

export const APPLY_FORM_PAGE_HEADER = {
  title: "Cleaner application",
  subtitle: "Complete the short form so our team can review your details.",
  reviewNote:
    "Applications are reviewed before cleaner accounts are activated. Shalean does not create active cleaners automatically.",
  backLabel: "Back to apply page",
  backHref: APPLY_PAGE_PATH,
} as const;
