-- Add 8 more states for broader coverage (total 15 states = 225 pages)
INSERT INTO locations (slug, type, state_code, state_name, bea_geofips, is_active)
VALUES
  ('wa', 'state', 'WA', 'Washington', 'STATE', true),
  ('ma', 'state', 'MA', 'Massachusetts', 'STATE', true),
  ('az', 'state', 'AZ', 'Arizona', 'STATE', true),
  ('co', 'state', 'CO', 'Colorado', 'STATE', true),
  ('nc', 'state', 'NC', 'North Carolina', 'STATE', true),
  ('oh', 'state', 'OH', 'Ohio', 'STATE', true),
  ('mi', 'state', 'MI', 'Michigan', 'STATE', true),
  ('va', 'state', 'VA', 'Virginia', 'STATE', true)
ON CONFLICT (slug) DO NOTHING;
