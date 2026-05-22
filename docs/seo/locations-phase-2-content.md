# Locations Phase 2 — Local authority content

## Content model

`src/features/marketing/locationAuthorityContent.ts`

Per suburb (`LOCATION_AUTHORITY_BY_SLUG`):

- `localOverview` — unique local cleaning context
- `popularServices` — 4 services with `{Service} in {suburb}` anchors
- `faqs` — 3 visible FAQs (rotated variants: homes, services, cost, recurring, equipment)

Hub (`LOCATION_REGIONS`):

- Atlantic Seaboard, City Bowl & nearby, Southern Suburbs, Northern Suburbs, West Coast & Table Bay

## Schema

Suburb pages add `FAQPage` JSON-LD from the same `authority.faqs` rendered in the page (no duplicate copy).

## Unchanged from Phase 1

- Canonical URLs (`/locations/{area}-cape-town`)
- Legacy redirects
- Sitemap entry count
- WebPage / Organization schema pattern

## Components

- `LocationSuburbAuthoritySections.tsx` — suburb page body
- `LocationsHubRegionsSection.tsx` — hub regional grouping + CTAs
