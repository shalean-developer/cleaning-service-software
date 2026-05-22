# Locations Phase 1 — Technical SEO Hardening

## Summary

Phase 1 strengthens the `/locations` cluster for crawl efficiency, canonical consolidation, schema clarity, and geographic internal linking—without UI redesign or booking changes.

## Before vs after

| Area | Before | After |
|------|--------|-------|
| Legacy URLs | `/locations/sea-point` → 404 | `/locations/sea-point` → 308 → canonical slug |
| Suburb schema | Duplicate `#localbusiness` on every page | Unique `#webpage` per suburb + single `#organization` |
| Hub schema | LocalBusiness only | Organization + CollectionPage + ItemList (12 suburbs) |
| Nearby links | None | 3–4 geographic neighbors per suburb |
| Hub anchors | Suburb name only | “Cleaning services in {area}” |
| Meta descriptions | Short template | Localized phrase per suburb |

## Redirect map

Generated at build time from `LOCATION_SEO_SLUGS` via `buildLocationLegacyRedirects()` in `src/features/marketing/locationRedirects.ts`.

| Legacy source | Destination |
|---------------|-------------|
| `/locations/{area}` | `/locations/{area}-cape-town` |

Examples:

- `/locations/sea-point` → `/locations/sea-point-cape-town`
- `/locations/table-view` → `/locations/table-view-cape-town`

Existing hub alias unchanged:

- `/locations/cape-town` → `/locations` (308)

Invalid slugs (e.g. `/locations/fake-cape-town`, `/locations/sea-point-cape-town-extra`) still **404** via `notFound()`.

Sitemap continues to list **canonical URLs only** (`/locations` + 12 `-cape-town` slugs).

## Schema strategy

### Global entity

- **Organization** `@id`: `https://shalean.co.za/#organization`
- One parent entity; no per-suburb branch offices or street addresses

### Hub (`/locations`)

- **CollectionPage** `@id`: `https://shalean.co.za/locations#webpage`
- **ItemList** — 12 `ListItem` entries with canonical suburb URLs
- **Organization** + **BreadcrumbList**

### Suburb pages (`/locations/[slug]`)

- **WebPage** `@id`: `https://shalean.co.za/locations/{slug}#webpage` (unique per page)
- `about` / `mainEntity` → Organization
- **areaServed** → `Place` named `{Suburb}, Cape Town` (not city-only)
- **BreadcrumbList**

Deprecated for suburb pages: `buildLocationBusinessSchema` (duplicate LocalBusiness `@id`).

## Nearby linking strategy

Defined in `src/features/marketing/locationNearbyAreas.ts`:

- 3–4 neighbors per suburb by geographic cluster (Atlantic Seaboard, Southern Suburbs, Northern Suburbs, Century City / Table Bay)
- Server-rendered “Nearby cleaning areas” section on each suburb page
- Anchor text: “Cleaning services in {area}”
- No self-links; no full 12-suburb grids

## Crawl validation checklist

### Routes

- [ ] `/locations` → 200
- [ ] All 12 `/locations/{area}-cape-town` → 200
- [ ] `/locations/{area}` (short) → 308 to canonical
- [ ] `/locations/cape-town` → 308 to `/locations`
- [ ] `/locations/invalid-cape-town` → 404

### Metadata

- [ ] Canonical: `https://shalean.co.za/locations/...`
- [ ] `robots`: index, follow
- [ ] Unique titles per suburb
- [ ] Unique meta descriptions (localized phrase)

### Schema

- [ ] Hub JSON-LD includes ItemList + CollectionPage + Organization
- [ ] Suburb JSON-LD: unique `#webpage` per URL
- [ ] No duplicate `#localbusiness` on suburb pages
- [ ] [Google Rich Results Test](https://search.google.com/test/rich-results) on sample suburb + hub

### Internal links

- [ ] Hub lists all 12 with descriptive anchors
- [ ] Each suburb has 3–4 nearby links to valid canonical paths
- [ ] No orphan suburbs in sitemap

### Sitemap

- [ ] `https://shalean.co.za/sitemap.xml` contains `/locations` + 12 canonical slugs only
- [ ] No legacy short URLs in sitemap

## Key files

| File | Purpose |
|------|---------|
| `src/features/marketing/locationRedirects.ts` | Legacy redirect generator |
| `src/features/marketing/locationNearbyAreas.ts` | Nearby map + link labels |
| `src/features/marketing/seo.ts` | WebPage / hub schema builders |
| `src/features/marketing/seo-pages.ts` | Localized meta descriptions |
| `src/app/(marketing)/locations/page.tsx` | Hub ItemList + anchors |
| `src/app/(marketing)/locations/[slug]/page.tsx` | Suburb schema + nearby section |
| `src/components/marketing/LocationNearbyAreasSection.tsx` | Nearby UI block |
| `next.config.ts` | Merges generated location redirects |

## Next phase (content depth)

Phase 2 can add on-page pricing snippets, suburb FAQs, reviews, and hub grouping/search—without changing canonical URLs established here.
