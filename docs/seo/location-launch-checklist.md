# Location launch checklist (Phase 5)

Canonical domain: **https://shalean.co.za**

Automated gate: `npm run ops:audit:location-launch` (static + registry).  
Optional live crawl: `LOCATION_LAUNCH_BASE_URL=https://shalean.co.za npm run ops:audit:location-launch`

Registry gate: `npm run ops:audit:location-registry`

---

## Pre-launch automated checks

- [ ] `npm run build` passes
- [ ] `npm run test` passes
- [ ] `npm run ops:audit:location-registry` — 146 operational, 12 SEO, `requiresReview = 0`
- [ ] `npm run ops:audit:location-launch` — static audit PASS

---

## Phase 5A — Public SEO pages (manual spot check)

| URL | Check |
|-----|--------|
| `/locations` | 200, hub regions, links to all 12 suburbs |
| `/locations/sea-point-cape-town` | 200, H1, FAQ, nearby areas, service links, book CTA |
| `/locations/claremont-cape-town` | 200, unique title/description |
| `/locations/table-view-cape-town` | 200, alias-friendly copy (Table View) |
| `/services` | 200, explore-by-area section |
| `/cleaning-prices-cape-town` | 200, suburb chips to location pages |

**Redirects (live)**

| URL | Expected |
|-----|----------|
| `/locations/sea-point` | 308 → `/locations/sea-point-cape-town` |
| `/locations/not-a-valid-suburb-cape-town` | 404 |
| `/locations/atlantis-cape-town` | 404 (operational-only, not SEO) |

---

## Phase 5B — Operational UX (manual spot check)

### Customer booking — suburb input

- [ ] Search “Sea”, “Tableview”, “Bo Kaap” resolves to canonical area
- [ ] Popular areas chips visible when field empty
- [ ] Region-grouped suggestions when typing
- [ ] Matched area confirmation shown
- [ ] Unknown suburb can still be entered (fallback copy)
- [ ] Mobile: dropdown scrollable, no layout overflow

### Cleaner apply — `/apply/application-form`

- [ ] Preferred areas: search filters chips
- [ ] Popular Cape Town areas shown first
- [ ] Selected areas summary readable on mobile
- [ ] Suburb field uses registry search (same as booking)
- [ ] Form still submits registry slugs (not broken payload)

### Admin — cleaner service areas

- [ ] Searchable grouped picker with region accordions
- [ ] Select all / clear region works
- [ ] Featured SEO areas quick-add
- [ ] Selected summary shows human names
- [ ] Advanced paste still works for edge cases
- [ ] Save preserves normalized slugs; legacy strings display as names

### Admin — search filters

- [ ] Bookings search finds suburb and aliases (e.g. “Tableview”)
- [ ] Customer registry shows formatted area labels
- [ ] Recurring series search matches suburb aliases
- [ ] Cleaner applications list shows formatted suburb

---

## Phase 5C — SEO / sitemap policy

- [ ] Sitemap has exactly **12** `/locations/*-cape-town` URLs + `/locations` hub
- [ ] No operational-only suburbs in sitemap (e.g. Atlantis)
- [ ] `/apply/application-form` **not** in sitemap
- [ ] All sitemap URLs on `https://shalean.co.za` (no localhost / vercel.app)
- [ ] `robots.txt` does not block `/locations`

---

## Phase 5D — Metadata & schema (View Source)

**Each suburb page**

- [ ] Unique `<title>` and meta description
- [ ] Canonical URL matches page path (`…-cape-town`)
- [ ] `robots` index,follow
- [ ] JSON-LD: WebPage + FAQPage + BreadcrumbList (no duplicate LocalBusiness branch)
- [ ] FAQ schema questions match visible FAQ text

**`/locations` hub**

- [ ] CollectionPage + ItemList in JSON-LD
- [ ] No fake street addresses per suburb in schema

---

## Phase 5E — Internal links

- [ ] No links to `/service` (only `/services/…`)
- [ ] No short `/locations/{area}` links (only `…-cape-town`)
- [ ] No generic “learn more” anchors in location/service cross-link blocks
- [ ] Service pages link to relevant suburb pages with descriptive anchors

---

## Phase 5H — Lighthouse (manual, production)

Run on live site after deploy (mobile + desktop):

| Page | SEO target | Notes |
|------|------------|--------|
| `/locations` | **100** SEO | Hub should stay server-rendered |
| `/locations/sea-point-cape-town` | **100** SEO | Sample suburb |
| `/services/deep-cleaning-cape-town` | 95+ SEO | Cross-links present |

Also check: no major CLS; operational pickers are client-only on booking/apply/admin (not on SEO pages).

**Commands (Chrome DevTools or CLI)**

```bash
npx lighthouse https://shalean.co.za/locations --only-categories=seo,performance,accessibility --view
npx lighthouse https://shalean.co.za/locations/sea-point-cape-town --only-categories=seo --view
```

---

## Post-launch monitoring

- [ ] Google Search Console: sitemap submitted, 12 suburb URLs + hub indexed over time
- [ ] Monitor Coverage for 404s on `/locations/*`
- [ ] Re-run `npm run ops:audit:location-launch` after any location/registry change

---

## Before expanding beyond 12 SEO pages

Resolve any open items from the latest `ops:audit:location-launch` report and complete this checklist. Do **not** add new `/locations/*-cape-town` pages or sitemap entries until product approves SEO expansion.
