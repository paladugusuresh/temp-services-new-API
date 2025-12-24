-- Core schema for temp services pricing API

-- Services catalog
CREATE TABLE IF NOT EXISTS services (
  id SERIAL PRIMARY KEY,
  key TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  unit TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Locations (states + major cities)
CREATE TABLE IF NOT EXISTS locations (
  id SERIAL PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('state', 'city')),
  state_code TEXT NOT NULL,
  state_name TEXT NOT NULL,
  city_name TEXT,
  bea_geofips TEXT,
  rpp_index NUMERIC(6,2) DEFAULT 100.0,
  rpp_year INTEGER,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_locations_state_code ON locations(state_code);
CREATE INDEX IF NOT EXISTS idx_locations_type ON locations(type);
CREATE INDEX IF NOT EXISTS idx_locations_is_active ON locations(is_active);

-- National baseline pricing (from manual research or industry averages)
CREATE TABLE IF NOT EXISTS national_pricing (
  id SERIAL PRIMARY KEY,
  service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  low NUMERIC(10,2) NOT NULL,
  typical NUMERIC(10,2) NOT NULL,
  high NUMERIC(10,2) NOT NULL,
  source TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(service_id)
);

-- Macro economic factors (CPI, etc.)
CREATE TABLE IF NOT EXISTS macro_factors (
  id SERIAL PRIMARY KEY,
  factor_type TEXT NOT NULL,
  series_id TEXT NOT NULL,
  year INTEGER NOT NULL,
  period TEXT NOT NULL,
  value NUMERIC(12,4) NOT NULL,
  is_baseline BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(factor_type, series_id, year, period)
);

CREATE INDEX IF NOT EXISTS idx_macro_factors_baseline ON macro_factors(factor_type, series_id, is_baseline);

-- Enforce single baseline per factor_type/series_id to prevent multiple baselines
CREATE UNIQUE INDEX IF NOT EXISTS ux_macro_factors_one_baseline
ON macro_factors (factor_type, series_id)
WHERE is_baseline = true;

-- Location-specific pricing estimates (computed from national + RPP + CPI)
CREATE TABLE IF NOT EXISTS location_pricing (
  id SERIAL PRIMARY KEY,
  service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  location_id INTEGER NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  low NUMERIC(10,2) NOT NULL,
  typical NUMERIC(10,2) NOT NULL,
  high NUMERIC(10,2) NOT NULL,
  inputs JSONB,
  computed_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(service_id, location_id)
);

CREATE INDEX IF NOT EXISTS idx_location_pricing_service ON location_pricing(service_id);
CREATE INDEX IF NOT EXISTS idx_location_pricing_location ON location_pricing(location_id);

-- Function to recompute location pricing
CREATE OR REPLACE FUNCTION recompute_location_pricing(p_location_id INTEGER DEFAULT NULL)
RETURNS VOID AS $$
DECLARE
  v_service RECORD;
  v_location RECORD;
  v_national RECORD;
  v_cpi_baseline NUMERIC;
  v_cpi_current NUMERIC;
  v_cpi_ratio NUMERIC;
  v_rpp_index NUMERIC;
  v_adjustment NUMERIC;
  v_low NUMERIC;
  v_typical NUMERIC;
  v_high NUMERIC;
  v_inputs JSONB;
BEGIN
  -- Get CPI baseline and current values
  SELECT value INTO v_cpi_baseline
  FROM macro_factors
  WHERE factor_type = 'CPI' AND is_baseline = true
  ORDER BY year DESC, period DESC
  LIMIT 1;

  SELECT value INTO v_cpi_current
  FROM macro_factors
  WHERE factor_type = 'CPI' AND is_baseline = false
  ORDER BY year DESC, period DESC
  LIMIT 1;

  -- If no baseline set, use current as baseline
  IF v_cpi_baseline IS NULL THEN
    v_cpi_baseline := v_cpi_current;
  END IF;

  -- If no CPI data at all, use ratio of 1
  IF v_cpi_current IS NULL OR v_cpi_baseline IS NULL THEN
    v_cpi_ratio := 1.0;
  ELSE
    v_cpi_ratio := v_cpi_current / v_cpi_baseline;
  END IF;

  -- Loop through locations
  FOR v_location IN 
    SELECT id, slug, rpp_index 
    FROM locations 
    WHERE is_active = true 
      AND (p_location_id IS NULL OR id = p_location_id)
  LOOP
    v_rpp_index := COALESCE(v_location.rpp_index, 100.0);
    
    -- Loop through all services
    FOR v_service IN SELECT id FROM services LOOP
      -- Get national pricing
      SELECT low, typical, high INTO v_national
      FROM national_pricing
      WHERE service_id = v_service.id;

      IF v_national IS NULL THEN
        CONTINUE;
      END IF;

      -- Calculate adjustment: CPI ratio * RPP adjustment
      v_adjustment := v_cpi_ratio * (v_rpp_index / 100.0);

      -- Apply adjustment to national prices
      v_low := ROUND(v_national.low * v_adjustment, 2);
      v_typical := ROUND(v_national.typical * v_adjustment, 2);
      v_high := ROUND(v_national.high * v_adjustment, 2);

      -- Build inputs JSON
      v_inputs := jsonb_build_object(
        'national_low', v_national.low,
        'national_typical', v_national.typical,
        'national_high', v_national.high,
        'cpi_baseline', v_cpi_baseline,
        'cpi_current', v_cpi_current,
        'cpi_ratio', v_cpi_ratio,
        'rpp_index', v_rpp_index,
        'adjustment_factor', v_adjustment
      );

      -- Upsert location pricing
      INSERT INTO location_pricing (service_id, location_id, low, typical, high, inputs, computed_at)
      VALUES (v_service.id, v_location.id, v_low, v_typical, v_high, v_inputs, now())
      ON CONFLICT (service_id, location_id)
      DO UPDATE SET
        low = EXCLUDED.low,
        typical = EXCLUDED.typical,
        high = EXCLUDED.high,
        inputs = EXCLUDED.inputs,
        computed_at = EXCLUDED.computed_at;
    END LOOP;
  END LOOP;
END;
$$ LANGUAGE plpgsql;
