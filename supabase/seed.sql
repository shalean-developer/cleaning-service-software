-- Sample services aligned with code-first pricing slugs (Phase 4).
-- Quotes use `serviceSlug` in application code; `services.id` links bookings when set.
-- E2E users/cleaners: run `npm run e2e:seed` (see docs/testing/live-e2e-smoke-test.md).

insert into public.services (name, description, default_duration_minutes, base_price_cents, currency, active)
values
  ('Regular Cleaning', 'Standard home clean (1 bed / 1 bath base)', 180, 45000, 'ZAR', true),
  ('Deep Cleaning', 'Detailed deep clean', 240, 85000, 'ZAR', true),
  ('Moving Cleaning', 'Move-in / move-out clean', 300, 120000, 'ZAR', true),
  ('Airbnb Cleaning', 'Short-stay turnover clean', 150, 55000, 'ZAR', true),
  ('Office Cleaning', 'Commercial office clean', 120, 60000, 'ZAR', true),
  ('Carpet Cleaning', 'Carpet zones per room', 90, 40000, 'ZAR', true);
