-- WorldLive initial database schema
-- Requires PostgreSQL + PostGIS extension

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── Layers ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS layers (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(64) NOT NULL UNIQUE,
    display_name VARCHAR(128) NOT NULL,
    enabled     BOOLEAN NOT NULL DEFAULT TRUE,
    color       VARCHAR(16) DEFAULT '#FFFFFF',
    icon        VARCHAR(64),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO layers (name, display_name, enabled, color, icon) VALUES
    ('earthquakes', 'Earthquakes',  TRUE,  '#FF6B35', 'seismic'),
    ('weather',     'Weather',      TRUE,  '#4FC3F7', 'cloud'),
    ('satellites',  'Satellites',   TRUE,  '#B39DDB', 'satellite'),
    ('volcanoes',   'Volcanoes',    TRUE,  '#FF5252', 'volcano'),
    ('wildfires',   'Wildfires',    TRUE,  '#FF8F00', 'fire'),
    ('airquality',  'Air Quality',  TRUE,  '#66BB6A', 'air')
ON CONFLICT (name) DO NOTHING;

-- ─── Events ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS events (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    external_id     VARCHAR(256),                           -- source-assigned ID for dedup
    type            VARCHAR(64) NOT NULL,                   -- earthquakes | weather | satellite | volcano | wildfire | airquality
    latitude        DOUBLE PRECISION NOT NULL,
    longitude       DOUBLE PRECISION NOT NULL,
    geom            GEOMETRY(Point, 4326),                  -- PostGIS spatial column
    timestamp       TIMESTAMPTZ NOT NULL,
    severity        SMALLINT NOT NULL DEFAULT 0,            -- 0-5 (0=unknown, 5=extreme)
    title           TEXT,
    description     TEXT,
    payload         JSONB NOT NULL DEFAULT '{}',
    source_url      TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT events_type_check CHECK (type IN (
        'earthquake','weather','satellite','volcano','wildfire','airquality'
    ))
);

-- Spatial index
CREATE INDEX IF NOT EXISTS events_geom_idx     ON events USING GIST (geom);
CREATE INDEX IF NOT EXISTS events_type_idx     ON events (type);
CREATE INDEX IF NOT EXISTS events_timestamp_idx ON events (timestamp DESC);
CREATE INDEX IF NOT EXISTS events_ext_id_idx   ON events (external_id);

-- Trigger: auto-populate geom from lat/lon
CREATE OR REPLACE FUNCTION events_set_geom()
RETURNS TRIGGER AS $$
BEGIN
    NEW.geom = ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS events_geom_trigger ON events;
CREATE TRIGGER events_geom_trigger
    BEFORE INSERT OR UPDATE ON events
    FOR EACH ROW EXECUTE FUNCTION events_set_geom();

-- ─── History / Snapshots ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS history (
    id              BIGSERIAL PRIMARY KEY,
    event_id        UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    snapshot_time   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    payload         JSONB NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS history_event_idx   ON history (event_id);
CREATE INDEX IF NOT EXISTS history_time_idx    ON history (snapshot_time DESC);

-- ─── Users (single-admin self-hosted) ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
    id          SERIAL PRIMARY KEY,
    username    VARCHAR(64) NOT NULL UNIQUE,
    hashed_pw   TEXT NOT NULL,
    is_admin    BOOLEAN NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
