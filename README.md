# OTP Sentinel — Weather & Delay-Risk Monitoring

Built for the **Cursor Hands Off London Hackathon**. This is a scoped-down slice of the
full "AI OTP Optimisation Company" concept in [`docs/cursoridea.txt`](docs/cursoridea.txt):
the **weather monitoring**, **weather-driven delay-risk monitoring**, and **per-flight
delay forecasting** pieces, for ~100 popular airports worldwide (excluding the USA and
Russia), keyed by ICAO code.

**Live:** https://fly-autonomous-delta.vercel.app
**Repo:** https://github.com/zidanefrost/fly-autonomous

## What it does

Every 10 minutes, an autonomous worker fetches live METAR weather observations for all
monitored airports, scores each one's delay risk using an explainable rule-based engine,
and pushes the result to a live dashboard in real time. A single-prompt landing page lets
anyone ask a free-text question ("What's happening in Asia?") and get an AI-generated
answer (Manus) drawn from the live dataset. A separate per-flight tool takes a departure
(and optional arrival) airport plus a scheduled time and returns a 0–100 delay-risk
forecast — built on TAF forecast data, not just current conditions — with explainable
factors and advice on when to check in.

No flight-schedule data is used anywhere — delay risk is a weather-driven proxy (real
flight-delay APIs require a paid key this project doesn't have), explicitly framed as
such throughout the UI.

- **Data sources:** [aviationweather.gov](https://aviationweather.gov/data/api/) METAR
  (current conditions) and TAF (forecast) — both free, no API key, authoritative
  FAA/NWS-derived flight categories (VFR/MVFR/IFR/LIFR).
- **Risk engine:** pure, unit-tested, explainable — every score comes with a list of
  the specific factors that produced it (gusts, thunderstorms, fog, etc.), not a black
  box. Forecast scoring merges overlapping BECMG/TEMPO/PROB30 periods into a single
  worst-case window rather than arbitrarily picking one.
- **Autonomy:** the Modal cron worker runs unattended — observe, score, write — with a
  manual override endpoint for live-demo control.
- **Resilience:** the dashboard runs against bundled mock data with zero cloud
  credentials, and falls back to a local summary if the AI briefing service is
  unavailable — it's demoable even if the venue wifi or a sponsor API has a bad day.
  Both the METAR and TAF fetchers tolerate upstream flakiness (transient 502s, fully
  empty 204 responses for unknown airport codes) without losing data for the rest of
  the batch.

## Architecture

```
worker/      Modal Python app — the autonomous monitoring agent
supabase/    Postgres schema, RLS policies, ~100-airport seed data
frontend/    Vite + React + TypeScript dashboard (MapLibre + Supabase Realtime)
```

- **Modal** (`worker/app.py`): one app, several functions — a `Cron` job every 10
  minutes that fetches METAR for all airports in a single batched request, scores each
  with `risk_engine.py`, and upserts to Supabase; an on-demand HTTP endpoint for manual
  refresh; a proxy endpoint for the Manus AI ops-briefing feature (keeps the API key
  server-side); and a `flight_forecast` endpoint that fetches TAF for a specific
  airport/time and returns a forecast risk score plus check-in advice.
- **Supabase** (`supabase/schema.sql`): `airports`, `weather_observations`, `delay_risk`
  tables, public read-only RLS, and `delay_risk`/`weather_observations` added to the
  `supabase_realtime` publication so the dashboard updates live with no polling.
- **Frontend**: a single-prompt landing page (one input box, optional free-text
  question routed to Manus, answers drawn from the live dataset) followed by detailed
  sections — live proof stats, a 5-stage "how it works" breakdown, the per-flight
  forecast tool, a sourced cost-of-delay analysis, a feature grid, and a usage guide —
  then a full "ops control room" dashboard one scroll down: an animated world map
  (MapLibre, CARTO dark basemap, no API key), sortable/filterable airport table, and a
  detail panel showing the raw METAR next to the decoded risk explanation.

### Why Manus AI and not PayPal's agent sandbox

The user asked to lean on as many of the event's sponsor/judge tools as fit naturally.
**Manus AI** (a hackathon sponsor) is wired in for the on-demand "AI Ops Briefing" and
the single-prompt question box — a real, verified integration against its `v2/task.create`
API. **PayPal's agent sandbox** is for payments/billing and has no honest connection to
a monitoring-only feature — left as a natural extension point for a future Sales/Billing
agent, not faked here.

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
This activates the 10-minute cron and prints the endpoint URLs (`trigger_refresh`,
`ai_briefing`, `ai_briefing_status`, `flight_forecast`) — copy the base URL for step 3.

### 3. Frontend
```bash
cd frontend
npm install
cp .env.example .env.local   # fill in VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY / VITE_WORKER_BASE_URL
npm run dev
```
Leave `.env.local` empty/unset to run against bundled mock data instead — useful for UI
iteration or as a demo-day fallback.

### 4. Deploying the frontend (optional)
```bash
cd frontend
npx vercel link
npx vercel env add VITE_SUPABASE_URL production
npx vercel env add VITE_SUPABASE_ANON_KEY production
npx vercel env add VITE_WORKER_BASE_URL production
npx vercel --prod
```

## Judging-criteria notes

- **Technical execution:** explainable rule-based risk engine, unit-tested (19 tests)
  against real METAR/TAF fixtures; defensive parsing for the source API's mixed-type
  fields and transient failure modes (502s, empty 204 responses).
- **Product thinking:** scoped down deliberately from the full 6-agent brief to one
  coherent slice; chose a weather-driven proxy over a paid flight-delay API rather than
  guessing; declined to fake a PayPal integration that had no honest connection to a
  monitoring-only feature.
- **Agent autonomy:** the Modal cron worker observes, scores, and writes unattended on
  a schedule — no human in the loop for the core monitoring function.
- **UX clarity:** a single-prompt entry point for the common case, with full technical
  depth available one scroll down for anyone who wants to drill in; responsive down to
  phone-width viewports.
- **Real-world applicability:** uses the same VFR/MVFR/IFR/LIFR categories and delay
  drivers (thunderstorms, fog, gusts, icing) that real airline ops teams use, and
  industry-sourced (Airlines for America, Eurocontrol) cost-of-delay figures rather than
  invented ones.
- **Safety & oversight design:** every risk score is paired with the specific factors
  that produced it (no black box); stale observations are flagged rather than silently
  trusted; forecasts outside the TAF's valid window honestly say so rather than guessing;
  the system is read-only/advisory — it recommends, it doesn't act on real airline systems.
