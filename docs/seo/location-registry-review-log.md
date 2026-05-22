# Location registry review log (Phase 3.5 review)

**Date:** 2026-05-22  
**Audit before review:** 29 `requiresReview` areas  
**Audit after review:** 0 pending review  
**Operational areas:** 146 (Brooklyn Chestnut duplicate label merged into Brooklyn)  
**SEO locations:** 12 (unchanged)

## Summary

| Decision | Count |
|----------|------:|
| valid_cape_town_suburb | 22 |
| valid_western_cape_town | 1 |
| broad_region_label | 4 |
| duplicate_or_alias | 1 |
| typo_or_needs_rename | 0 (handled at import: Tableview, Oudshoorn) |
| unsupported_or_remove | 0 |

## Reviewed areas

| Area | Decision | Operational | Future SEO candidate | Reason |
|------|----------|-------------|----------------------|--------|
| Atlantis | valid_cape_town_suburb | Yes | No | West Coast township; valid service area |
| Bishopscourt | valid_cape_town_suburb | Yes | Yes | Southern Suburbs estate near Claremont |
| Bothasig | valid_cape_town_suburb | Yes | No | Northern Suburbs near Milnerton |
| Brooklyn | valid_cape_town_suburb | Yes | No | Cape Town Brooklyn; alias for Brooklyn Chestnut |
| Brooklyn Chestnut | duplicate_or_alias | Merged | No | Duplicate of Brooklyn — label removed from import list |
| Cape Flats | broad_region_label | Yes | No | Broad booking label, not a single suburb |
| Cape Gate | valid_cape_town_suburb | Yes | No | Kuils River / Century City retail node |
| Edgemead | valid_cape_town_suburb | Yes | No | Northern Suburbs residential |
| Elsies River | valid_cape_town_suburb | Yes | No | Northern Suburbs / Cape Flats edge |
| Heathfield | valid_cape_town_suburb | Yes | No | Southern Suburbs |
| Helderberg | broad_region_label | Yes | No | Basin label — prefer Somerset West, Strand |
| Joe Slovo Park | valid_cape_town_suburb | Yes | No | Cape Flats township |
| Maitland | valid_cape_town_suburb | Yes | No | City Bowl fringe |
| Marina da Gama | valid_cape_town_suburb | Yes | No | False Bay coastal (Marina Da Gama in registry) |
| Montague Gardens | valid_cape_town_suburb | Yes | No | West Coast business precinct |
| Mouille Point | valid_cape_town_suburb | Yes | Yes | Atlantic Seaboard |
| Ndabeni | valid_cape_town_suburb | Yes | No | City Bowl fringe industrial |
| Northern Suburbs | broad_region_label | Yes | No | Broad label — use Bellville, Durbanville, etc. |
| Pinelands | valid_cape_town_suburb | Yes | Yes | Established suburb near Century City |
| Plettenberg Bay | valid_western_cape_town | Yes | No | Garden Route — outside Cape Town SEO cluster |
| Protea Valley | valid_cape_town_suburb | Yes | No | Cape Flats residential |
| Rylands | valid_cape_town_suburb | Yes | No | Cape Flats near Athlone |
| Southern Suburbs | broad_region_label | Yes | No | Broad label — use Claremont, Wynberg, etc. |
| Sunningdale | valid_cape_town_suburb | Yes | No | Blouberg / Table Bay fringe |
| Three Anchor Bay | valid_cape_town_suburb | Yes | Yes | Atlantic Seaboard near Sea Point |
| Walmer Estate | valid_cape_town_suburb | Yes | No | City Bowl fringe |
| Wetton | valid_cape_town_suburb | Yes | No | Southern Suburbs |
| Youngsfield | valid_cape_town_suburb | Yes | No | Southern Suburbs |
| Zeekoevlei | valid_cape_town_suburb | Yes | No | Cape Flats / wetland fringe |

## Import normalizations (pre-review)

| Input | Canonical | Decision |
|-------|-----------|----------|
| Tableview | Table View | duplicate_or_alias (deduped at import) |
| Oudshoorn | Oudtshoorn | typo_or_needs_rename |
| D'urbanvale | Durbanville | duplicate_or_alias (SEO suburb) |

## Code changes

- `src/features/locations/locationReviewOverrides.ts` — reviewed metadata
- `src/features/locations/locationRegistry.ts` — apply overrides, expanded region patterns
- `src/features/locations/operationalAreaLabels.ts` — removed Brooklyn Chestnut duplicate label

## Promotion rules (unchanged)

Only areas in `seoLocationSeeds.ts` with `isSeoLocation: true` receive `/locations/{slug}-cape-town` pages.  
Future SEO candidates above require unique local content before promotion.

## Verification

```bash
npm run ops:audit:location-registry
npx vitest run src/features/locations/
npm run build
```
