# Location registry strategy (Phase 3.5)

## Single source of truth

`src/features/locations/locationRegistry.ts` powers:

- SEO suburb pages (12 canonical URLs only)
- Operational service areas (100+ suburbs/towns)
- Booking suburb suggestions (datalist — free text still allowed)
- Cleaner service areas (admin + apply)
- Dispatch `area_slug` normalization via `resolveAreaSlug()`

Raw import labels live in `operationalAreaLabels.ts` (`House Cleaning {area}`).

## SEO vs operational

| Flag | Meaning |
|------|---------|
| `isOperationalArea` | Booking, cleaners, dispatch, admin filters |
| `isSeoLocation` | Full `/locations/{slug}-cape-town` page + sitemap |
| `isFeatured` | SEO suburbs (12) — highlighted in apply/admin pickers |
| `requiresReview` | Broad/ambiguous geography — not auto-promoted to SEO |

New areas from search data default to **operational only**. They do not appear in the sitemap or `generateStaticParams`.

## Promoting an area to SEO

1. Add or confirm entry in `seoLocationSeeds.ts` with `seoSlug` and `canonicalPath`.
2. Set `isSeoLocation: true`, `isFeatured: true` on the registry entry (via seed merge).
3. Add `locationAuthorityContent` for the suburb (Phase 2 pattern).
4. Update `LOCATION_NEARBY_BY_SLUG` and internal cross-links.
5. Run marketing/SEO tests and confirm sitemap count increases only by deliberate choice.

Do not bulk-promote 100+ areas — avoids thin doorway pages.

## Booking

- Suburb field uses `OperationalSuburbInput` (datalist from `getBookingLocationOptions()`).
- Street address remains free text.
- `normalizeAreaSlug` / `resolveAreaSlug` map aliases to registry slugs for dispatch.

## Cleaner areas

- Admin create/edit: `AdminServiceAreasTextarea` with operational datalist.
- Apply form: `OperationalAreaChipGroups` grouped by region.
- Empty cleaner areas = serves all areas (unchanged).

## Expansion plan

- **Now:** 12 SEO pages, 100+ operational areas
- **Later:** 20–35 SEO suburbs when unique local content exists per area
- **Not yet:** Programmatic combo service×location pages

## Audit

```bash
npm run ops:audit:location-registry
```
