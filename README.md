# OTP Sentinel — Weather & Delay-Risk Monitoring

Built for the **Cursor Hands Off London Hackathon**. This is a scoped-down slice of the
full "AI OTP Optimisation Company" concept in [`docs/cursoridea.txt`](docs/cursoridea.txt):
just the **weather monitoring** and **weather-driven delay-risk monitoring** pieces,
for ~100 popular airports worldwide (excluding the USA and Russia), keyed by ICAO code.

## What it does

Every 10 minutes, an autonomous worker fetches live METAR weather observations for all
monitored airports, scores each one's delay risk using an explainable rule-based engine,
and pushes the result to a live dashboard. No flight-schedule data is used — delay risk
here is a weather-driven proxy (real flight-delay APIs require a paid key this project
doesn't have), explicitly framed as such throughout the UI.

- **Data source:** [aviationweather.gov](https://aviationweather.gov/data/api/) — free,
  no API key, authoritative FAA/NWS-derived flight categories (VFR/MVFR/IFR/LIFR).
- **Risk engine:** pure, unit-tested, explainable — every score comes with a list of
  the specific factors that produced it (gusts, thunderstorms, fog, etc.), not a black box.
- **Autonomy:** the Modal cron worker runs unattended — observe, score, write, alert —
  with a manual override endpoint for live-demo control.
- **Resilience:** the dashboard runs against bundled mock data with zero cloud
  credentials, and falls back to a local summary if the AI briefing service is
  unavailable — it's demoable even if the venue wifi or a sponsor API has a bad day.

## Architecture

```
worker/      Modal Python app — the autonomous monitoring agent
supabase/    Postgres schema, RLS policies, ~100-airport seed data
frontend/    Vite + React + TypeScript dashboard (MapLibre + Supabase Realtime)
```

- **Modal** (`worker/app.py`): one app, three functions — a `Cron` job every 10 minutes
  that fetches METAR for all airports in a single batched request, scores each with
  `risk_engine.py`, and upserts to Supabase; an on-demand HTTP endpoint for manual refresh;
  and a proxy endpoint for the Manus AI ops-briefing feature (keeps the API key server-side).
- **Supabase** (`supabase/schema.sql`): `airports`, `weather_observations`, `delay_risk`
  tables, public read-only RLS, and `delay_risk`/`weather_observations` added to the
  `supabase_realtime` publication so the dashboard updates live with no polling.
- **Frontend**: a dark "ops control room" dashboard — animated world map (MapLibre,
  CARTO dark basemap, no API key), sortable/filterable airport table, a detail panel
  showing the raw METAR next to the decoded risk explanation, and an on-demand AI
  ops briefing button.

### Why Manus AI and not PayPal's agent sandbox or Wassist

The user asked to lean on as many of the event's sponsor/judge tools as fit naturally.
**Manus AI** (a hackathon sponsor) is wired in for the on-demand "AI Ops Briefing" —
a real, verified integration against its `v2/task.create` API. **PayPal's agent sandbox**
is for payments/billing and has no honest connection to a monitoring-only feature — it's
left as a natural extension point for the future Sales/Billing agent, not faked here.
**Wassist** (its founder judges this hackathon, not a listed sponsor) has no public
developer API documented at the time of writing; `worker/wassist_client.py` is a clean,
ready-to-fill alert-channel stub rather than a fabricated integration — wire in the real
endpoint once you have Wassist's actual API docs/credentials.

## Setup

### 1. Supabase
1. Create a project at [supabase.com](https://supabase.com).
2. Open the SQL editor and run [`supabase/schema.sql`](supabase/schema.sql) — creates
   tables, RLS policies, the realtime publication, and seeds all ~100 airports.
3. Note your Project URL, anon key, and service-role key (Settings → API).

### 2. Modal worker
```bash
cd worker
pip install -r requirements.txt
modal secret create supabase-creds SUPABASE_URL=<url> SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
modal secret create manus-creds MANUS_API_KEY=<your-manus-key>   # optional, for AI briefings
pytest tests/                      # verify the risk engine first
modal deploy app.py
```
This activates the 10-minute cron and prints the three endpoint URLs
(`trigger_refresh`, `ai_briefing`, `ai_briefing_status`) — copy the base URL for step 3.

### 3. Frontend
```bash
cd frontend
npm install
cp .env.example .env.local   # fill in VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY / VITE_WORKER_BASE_URL
npm run dev
```
Leave `.env.local` empty/unset to run against bundled mock data instead — useful for UI
iteration or as a demo-day fallback.

## Judging-criteria notes

- **Technical execution:** explainable rule-based risk engine, unit-tested against real
  METAR fixtures; defensive parsing for the source API's mixed-type fields.
- **Agent autonomy:** the Modal cron worker observes, scores, writes, and alerts
  unattended on a schedule — no human in the loop for the core monitoring function.
- **Safety & oversight design:** every risk score is paired with the specific factors
  that produced it (no black box); stale observations are flagged rather than silently
  trusted; the system is read-only/advisory — it recommends, it doesn't act on real
  airline systems.
- **Real-world applicability:** uses the same VFR/MVFR/IFR/LIFR categories and delay
  drivers (thunderstorms, fog, gusts, icing) that real airline ops teams use.
