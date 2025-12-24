-- Seed initial set of states (7 major states to start)
INSERT INTO locations (slug, type, state_code, state_name, bea_geofips, is_active)
VALUES
  ('ca', 'state', 'CA', 'California', 'STATE', true),
  ('tx', 'state', 'TX', 'Texas', 'STATE', true),
  ('fl', 'state', 'FL', 'Florida', 'STATE', true),
  ('ny', 'state', 'NY', 'New York', 'STATE', true),
  ('pa', 'state', 'PA', 'Pennsylvania', 'STATE', true),
  ('il', 'state', 'IL', 'Illinois', 'STATE', true),
  ('ga', 'state', 'GA', 'Georgia', 'STATE', true)
ON CONFLICT (slug) DO NOTHING;

-- Major cities can be added later with RPP metro data
-- Examples (commented out for now):
-- ('ca-san-francisco', 'city', 'CA', 'California', 'San Francisco', 'METRO_41860', true),
-- ('ny-new-york', 'city', 'NY', 'New York', 'New York City', 'METRO_35620', true),
