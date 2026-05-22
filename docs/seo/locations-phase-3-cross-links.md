# Locations Phase 3 — Service/location cross-linking

## Module

`src/features/marketing/serviceLocationCrossLinks.ts`

Per `ServiceSlug`:
- `introCopy`
- `featuredAreas` (6–8 suburbs)
- Generated `links` with `{Service} in {Suburb}` anchors and canonical `/locations/{area}-cape-town` hrefs

## Components

| Component | Used on |
|-----------|---------|
| `ServiceLocationAreasSection` | Each `/services/*-cape-town` money page |
| `ServicesHubExploreByAreaSection` | `/services` hub (regional chips) |
| `PricingHubAreaLinksSection` | `/cleaning-prices-cape-town` |

## Inbound coverage

Every suburb receives at least one service-page link (enforced by `assertAllAreasReceiveServiceInboundLinks`).

## Unchanged

- Service and location canonical URLs
- Sitemap entry count
- No combo service-location pages
