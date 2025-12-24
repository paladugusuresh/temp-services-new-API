-- Remove duplicate services (keep moving-help, delete moving; keep plumbing, delete plumber)
DELETE FROM services WHERE key IN ('moving', 'plumber');

-- Normalize units for existing services
UPDATE services SET unit = 'hour' WHERE key IN ('handyman', 'electrician', 'hvac', 'painting', 'carpentry', 'landscaping', 'house-cleaning', 'plumbing', 'moving-help');
UPDATE services SET unit = 'visit' WHERE key IN ('lawn-mowing', 'snow-removal', 'pest-control');
UPDATE services SET unit = 'day' WHERE key = 'pet-sitting';
UPDATE services SET unit = 'job' WHERE key IN ('junk-removal', 'yard-cleanup', 'leaf-removal');
UPDATE services SET unit = 'sq_ft' WHERE key IN ('roofing', 'pressure-washing');
UPDATE services SET unit = 'repair' WHERE key IN ('appliance-repair', 'garage-door-repair');
UPDATE services SET unit = 'room' WHERE key = 'carpet-cleaning';
UPDATE services SET unit = 'linear_ft' WHERE key = 'gutter-cleaning';
UPDATE services SET unit = 'week' WHERE key = 'dumpster-rental';

-- Clean up service names (remove "Service" suffix for consistency)
UPDATE services SET name = 'Carpentry' WHERE key = 'carpentry';
UPDATE services SET name = 'Handyman' WHERE key = 'handyman';
UPDATE services SET name = 'Landscaping' WHERE key = 'landscaping';
UPDATE services SET name = 'Painting' WHERE key = 'painting';
