-- National baseline pricing (US average, approximate industry data)
-- These are baseline values that will be adjusted by RPP and CPI
-- Normalized units and duplicates removed (moving→moving-help, plumber→plumbing)
-- Sources are internal baseline ranges, not third-party quotes

INSERT INTO national_pricing (service_id, low, typical, high, source, baseline_year, baseline_month)
SELECT 
  s.id,
  pricing.low,
  pricing.typical,
  pricing.high,
  pricing.source,
  2024,
  1
FROM services s
JOIN (VALUES
  ('appliance-repair', 80.00, 150.00, 300.00, 'baseline_estimate_v1'),
  ('carpentry', 40.00, 65.00, 100.00, 'baseline_estimate_v1'),
  ('carpet-cleaning', 25.00, 45.00, 75.00, 'baseline_estimate_v1'),
  ('dumpster-rental', 250.00, 400.00, 650.00, 'baseline_estimate_v1'),
  ('electrician', 50.00, 80.00, 130.00, 'baseline_estimate_v1'),
  ('garage-door-repair', 100.00, 200.00, 400.00, 'baseline_estimate_v1'),
  ('gutter-cleaning', 0.50, 1.00, 2.00, 'baseline_estimate_v1'),
  ('handyman', 40.00, 65.00, 100.00, 'baseline_estimate_v1'),
  ('house-cleaning', 25.00, 40.00, 65.00, 'baseline_estimate_v1'),
  ('hvac', 75.00, 110.00, 150.00, 'baseline_estimate_v1'),
  ('junk-removal', 150.00, 300.00, 600.00, 'baseline_estimate_v1'),
  ('landscaping', 35.00, 55.00, 85.00, 'baseline_estimate_v1'),
  ('lawn-mowing', 30.00, 50.00, 80.00, 'baseline_estimate_v1'),
  ('leaf-removal', 100.00, 200.00, 400.00, 'baseline_estimate_v1'),
  ('moving-help', 30.00, 50.00, 80.00, 'baseline_estimate_v1'),
  ('painting', 35.00, 55.00, 90.00, 'baseline_estimate_v1'),
  ('pest-control', 100.00, 175.00, 300.00, 'baseline_estimate_v1'),
  ('pet-sitting', 25.00, 45.00, 75.00, 'baseline_estimate_v1'),
  ('plumbing', 50.00, 75.00, 125.00, 'baseline_estimate_v1'),
  ('pressure-washing', 0.15, 0.30, 0.50, 'baseline_estimate_v1'),
  ('roofing', 3.50, 5.50, 8.50, 'baseline_estimate_v1'),
  ('snow-removal', 40.00, 75.00, 150.00, 'baseline_estimate_v1'),
  ('yard-cleanup', 100.00, 200.00, 400.00, 'baseline_estimate_v1')
) AS pricing(service_key, low, typical, high, source)
  ON s.key = pricing.service_key
ON CONFLICT (service_id) DO UPDATE SET
  low = EXCLUDED.low,
  typical = EXCLUDED.typical,
  high = EXCLUDED.high,
  source = EXCLUDED.source,
  baseline_year = EXCLUDED.baseline_year,
  baseline_month = EXCLUDED.baseline_month,
  updated_at = now();
