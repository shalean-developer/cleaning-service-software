/** Shared E2E smoke-test identifiers — never use for production data. */

import { loadEnvFiles } from "./env.mjs";

loadEnvFiles();

export const E2E_PREFIX = "test_e2e_";

export const E2E_PASSWORD = "TestE2e!2026Shalean";

const DEFAULT_E2E_EMAILS = {
  customer: `${E2E_PREFIX}customer@shalean.co.za`,
  cleaner: `${E2E_PREFIX}cleaner@shalean.co.za`,
  admin: `${E2E_PREFIX}admin@shalean.co.za`,
};

/** Read E2E inbox addresses from env (set in .env.local before `npm run e2e:seed`). */
export function resolveE2eEmails() {
  return {
    customer:
      process.env.E2E_TEST_CUSTOMER_EMAIL?.trim() || DEFAULT_E2E_EMAILS.customer,
    cleaner: process.env.E2E_TEST_CLEANER_EMAIL?.trim() || DEFAULT_E2E_EMAILS.cleaner,
    admin: process.env.E2E_TEST_ADMIN_EMAIL?.trim() || DEFAULT_E2E_EMAILS.admin,
  };
}

export const E2E_EMAILS = resolveE2eEmails();

export const E2E_LABELS = {
  customerCompany: `${E2E_PREFIX}customer`,
  customerName: "E2E Test Customer",
  cleanerName: "E2E Test Cleaner",
  adminName: "E2E Test Admin",
  cleanerPhone: `${E2E_PREFIX}cleaner_phone`,
};

export const E2E_AREA_SLUG = "cape-town";

export const E2E_SERVICE_SLUGS = [
  "regular-cleaning",
  "deep-cleaning",
  "moving-cleaning",
  "airbnb-cleaning",
  "office-cleaning",
  "carpet-cleaning",
];

/** Catalog rows aligned with src/features/pricing/server/catalog.ts */
export const E2E_SERVICES = [
  { name: "Regular Cleaning", description: "regular-cleaning", minutes: 180, cents: 45000 },
  { name: "Deep Cleaning", description: "deep-cleaning", minutes: 240, cents: 85000 },
  { name: "Moving Cleaning", description: "moving-cleaning", minutes: 300, cents: 120000 },
  { name: "Airbnb Cleaning", description: "airbnb-cleaning", minutes: 150, cents: 55000 },
  { name: "Office Cleaning", description: "office-cleaning", minutes: 120, cents: 60000 },
  { name: "Carpet Cleaning", description: "carpet-cleaning", minutes: 90, cents: 40000 },
];

/** Mon–Sat 08:00–18:00 Africa/Johannesburg (0=Sun … 6=Sat) */
export const E2E_AVAILABILITY_DAYS = [1, 2, 3, 4, 5, 6];

export function isE2eCompanyName(name) {
  return typeof name === "string" && name.startsWith(E2E_PREFIX);
}

export function isE2eEmail(email) {
  return typeof email === "string" && email.startsWith(E2E_PREFIX);
}
