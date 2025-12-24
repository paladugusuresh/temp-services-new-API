-- Seed common temporary services (normalized units, duplicates removed)
-- Units normalized: hour, visit, job, day, week, room, linear_ft, sq_ft, repair
INSERT INTO services (key, name, unit) VALUES
  ('appliance-repair', 'Appliance Repair', 'repair'),
  ('carpentry', 'Carpentry', 'hour'),
  ('carpet-cleaning', 'Carpet Cleaning', 'room'),
  ('dumpster-rental', 'Dumpster Rental', 'week'),
  ('electrician', 'Electrician', 'hour'),
  ('garage-door-repair', 'Garage Door Repair', 'repair'),
  ('gutter-cleaning', 'Gutter Cleaning', 'linear_ft'),
  ('handyman', 'Handyman', 'hour'),
  ('house-cleaning', 'House Cleaning', 'hour'),
  ('hvac', 'HVAC Technician', 'hour'),
  ('junk-removal', 'Junk Removal', 'job'),
  ('landscaping', 'Landscaping', 'hour'),
  ('lawn-mowing', 'Lawn Mowing', 'visit'),
  ('leaf-removal', 'Leaf Removal', 'job'),
  ('moving-help', 'Moving Help', 'hour'),
  ('painting', 'Painting', 'hour'),
  ('pest-control', 'Pest Control', 'visit'),
  ('pet-sitting', 'Pet Sitting', 'day'),
  ('plumbing', 'Plumbing', 'hour'),
  ('pressure-washing', 'Pressure Washing', 'sq_ft'),
  ('roofing', 'Roofing', 'sq_ft'),
  ('snow-removal', 'Snow Removal', 'visit'),
  ('yard-cleanup', 'Yard Cleanup', 'job')
ON CONFLICT (key) DO NOTHING;
