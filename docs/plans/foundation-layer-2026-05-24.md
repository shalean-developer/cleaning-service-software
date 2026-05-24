# Shalean Foundation Layer Plan

Date: 2026-05-24

## Audit Summary

- The repository is an existing Next.js 16 App Router application with `src/app` route groups for marketing, customer, cleaner, admin, auth, API, payment, and Paystack flows.
- The app already contains a production-grade Supabase setup under `src/lib/supabase` and `supabase/`, with browser, server, and service-role clients plus extensive migrations and RLS tests.
- The existing platform already includes a full authenticated customer booking wizard, admin operations surfaces, cleaner offers/jobs, pricing logic, payment routes, notification systems, scripts, and docs.
- Marketing pages already exist under `src/app/(marketing)`, including `/`, `/services`, `/services/[slug]`, `/locations`, `/about`, `/contact`, `/faq`, legal pages, and SEO helpers.
- Shared dashboard shells already exist under `src/components/dashboard`, while marketing chrome exists under `src/components/marketing`.

## Foundation Scope

- Preserve existing booking, payment, dispatch, and dashboard behavior.
- Add a central six-service Shalean foundation catalogue for public service discovery.
- Add route-ready post-construction cleaning without adding checkout, Paystack, pricing, or cleaner assignment logic.
- Add a public booking start page that shows the six foundation services and hands off only bookable services to the existing customer booking wizard.
- Add reusable UI primitives and an environment example without changing the existing design system contract.

## Next Phase

- Decide whether post-construction cleaning should become priced and checkout-enabled.
- Align the operational pricing `ServiceSlug` model with the new public catalogue when the business is ready to add or retire service types.
- Add RLS-backed service configuration tables only after the static catalogue stabilizes.
