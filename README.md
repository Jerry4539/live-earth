# WorldLive 🌍

> **Self-hosted real-time global event monitoring on an interactive 3D globe**

No paid APIs. No subscriptions. One command to deploy.

<p align="center">
  <img src="assets/screenshots/image%201.jpeg" width="32%" alt="3D Globe View"/>
  <img src="assets/screenshots/image%202.jpeg" width="32%" alt="Event Filters"/>
  <img src="assets/screenshots/image%203.jpeg" width="32%" alt="Event Details & Charts"/>
</p>

---

## Features


- 🌍 **Interactive 3D Globe** (CesiumJS + OpenStreetMap tiles)
- 🌋 **Earthquakes** — USGS real-time feed, updated every 60s
- 🌤️ **Weather** — Open-Meteo global grid, updated every 5m
- 🛰️ **Satellites + ISS** — CelesTrak TLE + sgp4 propagation, updated every 30s
- 🌋 **Volcanoes** — Smithsonian GVP with known active volcanoes
- 🔥 **Wildfires** — NASA FIRMS MODIS data, updated every 5m
- 💨 **Air Quality** — OpenAQ PM2.5 stations worldwide
- 📡 **Real-time WebSocket** updates with auto-reconnect
- 🎬 **Replay engine** — 1h / 24h / 7d historical playback
- 🔍 **Geocode search** via Nominatim (OpenStreetMap)
- 🔒 **JWT auth** (single-admin self-hosted mode)
- 🐳 **Fully Dockerized** — PostgreSQL/PostGIS + Redis + FastAPI + React/Nginx

---

## Quick Start (Docker)

```bash
# 1. Clone / enter the project
cd worldlive

# 2. Copy and configure environment
cp .env.example .env
# Edit .env if you want to change admin credentials, API keys, etc.

# 3. Launch everything
docker compose up --build

# 4. Open in browser
open http://localhost:3000
```

**Login** with the default credentials (or those set in `.env`):
- Username: `admin`
- Password: `worldlive-admin`

---

## Local Development

### Backend
```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

# You need Postgres+PostGIS and Redis running locally
# Then update DATABASE_URL and REDIS_URL in .env

cp ../.env.example .env
uvicorn main:app --reload --port 8000
```

### Frontend
```bash
cd frontend
npm install
npm run dev        # → http://localhost:5173 (proxies to backend:8000)
```

---

## Data Sources

| Layer        | Source           | Interval | License    |
|-------------|------------------|----------|------------|
| Earthquakes  | USGS GeoJSON     | 60s      | Public     |
| Weather      | Open-Meteo       | 5m       | CC BY 4.0  |
| Satellites   | CelesTrak TLE    | 30s      | Public     |
| Volcanoes    | Smithsonian GVP  | 10m      | CC BY 4.0  |
| Wildfires    | NASA FIRMS MODIS | 5m       | Public     |
| Air Quality  | OpenAQ v3        | 3m       | CC BY 4.0  |

---

## Architecture

```
Browser (React + CesiumJS)
        │
   WebSocket + REST API
        │
   FastAPI Gateway
   ┌────┴────────────────┐
   │  APScheduler        │
   │  (6 collectors)     │
   │  ┌──────────────┐   │
   │  │ Redis pub/sub│   │
   │  └──────────────┘   │
   └──────────────────────┘
        │
 PostgreSQL (PostGIS) + Redis
```

---

## Environment Variables

See [`.env.example`](.env.example) for full documentation.

Key variables:
- `ADMIN_USERNAME` / `ADMIN_PASSWORD` — single-admin login
- `SECRET_KEY` — JWT signing key (change in production!)
- `NASA_FIRMS_MAP_KEY` — optional, for higher-resolution fire data
- `VITE_CESIUM_ION_TOKEN` — optional, for Cesium terrain/imagery (get free at [ion.cesium.com](https://ion.cesium.com))

---

## Success Criteria

- ✅ < 2 GB RAM idle
- ✅ < 5s cold start
- ✅ Modular collectors (add new data sources by extending `BaseCollector`)
- ✅ Fully Dockerized
- ✅ One-command deployment

---

## Roadmap

- **Phase 3**: Replay engine polish, analytics dashboard, full-text search
- **Phase 4**: ADS-B flights, AIS ships, Blitzortung lightning
- **Stretch**: Local LLM assistant (Ollama), heatmaps, mobile PWA
