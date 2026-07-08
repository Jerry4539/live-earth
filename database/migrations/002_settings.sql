-- WorldLive settings key-value table
CREATE TABLE IF NOT EXISTS settings (
    key         VARCHAR(128) PRIMARY KEY,
    value       TEXT NOT NULL DEFAULT '',
    description TEXT,
    is_secret   BOOLEAN NOT NULL DEFAULT FALSE,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed default keys (empty values — user fills via Settings UI)
INSERT INTO settings (key, value, description, is_secret) VALUES
    ('cesium_ion_token',    '', 'CesiumJS Ion access token — get free at https://ion.cesium.com', TRUE),
    ('nasa_firms_map_key',  '', 'NASA FIRMS MAP_KEY for wildfire data — https://firms.modaps.eosdis.nasa.gov/api/', TRUE),
    ('openaq_api_key',      '', 'OpenAQ API key for air quality data — https://openaq.org', TRUE),
    ('earthquakes_interval','60',  'Earthquake polling interval (seconds)', FALSE),
    ('weather_interval',    '300', 'Weather polling interval (seconds)', FALSE),
    ('satellites_interval', '30',  'Satellite polling interval (seconds)', FALSE),
    ('volcanoes_interval',  '600', 'Volcano polling interval (seconds)', FALSE),
    ('wildfires_interval',  '300', 'Wildfire polling interval (seconds)', FALSE),
    ('airquality_interval', '180', 'Air quality polling interval (seconds)', FALSE)
ON CONFLICT (key) DO NOTHING;
