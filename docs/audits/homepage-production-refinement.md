# Homepage Production Refinement (May 2026)

Refinement pass addressing the homepage production audit. Blue Shalean visual identity and section structure preserved.

## Luxury micro-polish pass (May 2026)

Elite service-brand elevation without structural changes:

- Typography utilities (`marketing-prose`, `marketing-prose-sm`) for calmer readability
- Hero cinematic treatment: warmth overlay, vignette, softer gradients, subtle image filter
- Services vertical breathing room; reviews warmth (gradient cards, soft shadows, stagger)
- CTA panel desaturated (`marketing-cta-panel`); footer gradient surface and refined chips
- Global shadows and section tints softened

## Premium polish pass (May 2026)

Launch-grade visual polish without structural or booking changes:

- Hero booking card: increased padding, field height, price/CTA spacing, dynamic estimate hint
- Section depth: alternating `marketing-section-tint` / white, layered shadows, subtle separators and glow
- Services: image focus per service, pill CTAs, hover lift, integrated local SEO content block
- Why Choose: tighter copy/image rhythm, icon cards on white tiles
- Reviews: suburb/context hierarchy, subtle card variance, improved avatars
- Footer: trust chips (vetted, coverage, hours), typography and spacing premiumization
- JSON-LD description aligned with homepage topical copy

## Deferred intentionally

- Real business phone (set `NEXT_PUBLIC_SHALEAN_PHONE_*` in production env)
- Legal pages (Terms, Privacy, Refund) — footer shows “coming soon”
- Blog nav removed until a blog route exists
- Guest booking without sign-up (auth unchanged per scope)
- Replacing Unsplash stock photography with brand assets
- `aggregateRating` JSON-LD removed until verifiable GBP data is available
