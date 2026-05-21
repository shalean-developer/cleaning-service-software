# Shalean SEO — Production Launch Checklist

Canonical domain: **https://shalean.co.za**

## Pre-deploy (code)

- [ ] `npm run build` passes
- [ ] `npm run test` passes (marketing sitemap + siteUrl tests)
- [ ] Set `NEXT_PUBLIC_MARKETING_SITE_URL=https://shalean.co.za` in Vercel production (optional; defaults are safe)

## Domain & redirects

- [ ] Apex domain `shalean.co.za` serves the Next.js app
- [ ] **www → apex:** `https://www.shalean.co.za` returns **301 or 308** to `https://shalean.co.za` (configure in Vercel Domains or DNS provider)
- [ ] No public HTML contains `localhost`, `vercel.app`, or `www.shalean.co.za` in canonicals, OG URLs, or sitemap

## Post-deploy smoke tests

| URL | Expected |
|-----|----------|
| `/` | 200 |
| `/sitemap.xml` | 200, all URLs on `https://shalean.co.za` |
| `/robots.txt` | 200, sitemap line points to production |
| `/cleaning-prices-cape-town` | 200 |
| `/faq`, `/contact`, `/reviews` | 200 |
| `/terms`, `/privacy`, `/refund-policy` | 200 |
| `/services/*` (6) | 200 |
| `/locations` + suburb pages | 200 |
| `/pricing-cape-town` | 308 → `/cleaning-prices-cape-town` |

## Google Search Console

1. Add property: `https://shalean.co.za` (domain or URL prefix)
2. Submit sitemap: `https://shalean.co.za/sitemap.xml`
3. URL inspection:
   - Homepage `/`
   - `/cleaning-prices-cape-town`
   - One service page (e.g. `/services/deep-cleaning-cape-town`)
   - One location page (e.g. `/locations/sea-point-cape-town`)
4. Request indexing for key URLs after deploy stabilises
5. Monitor **Pages** and **Coverage** for 404s and redirect chains

## Lighthouse (production URL)

Run on live site after deploy:

- Homepage
- `/cleaning-prices-cape-town`
- One service page
- One location page

Targets: SEO **95+**, Accessibility **95+**, Best Practices **95+**

## Schema policy

- No `AggregateRating` or unverified `Review` rich-result schema until tied to verified Google Business Profile data
- Homepage: single JSON-LD graph (`LocalBusiness`, `WebSite`, `FAQPage`)

## Remaining (Phase 4+)

- Blog / content hub
- Verified GBP-linked review schema
- Advanced performance (LCP, image CDN tuning)
- hreflang if expanding beyond Cape Town
