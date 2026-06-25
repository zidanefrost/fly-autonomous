# Fly Autonomous

An AI agent that watches the weather at ~100 major airports worldwide and tells you what's
about to go wrong — before it costs a delayed flight.

**Try it now, no setup needed → https://fly-autonomous-delta.vercel.app**

Built for the Cursor Hands Off London Hackathon, as a slice of the larger
["AI OTP Optimisation Company"](docs/cursoridea.txt) concept.

## What you can do with it

- **Ask a question.** Type anything ("What's happening in Asia right now?") and get an
  AI-written answer pulled from live weather data — or just hit enter for a default
  briefing.
- **Forecast a specific flight.** Pick a departure airport, an optional arrival airport,
  and a time. Get a 0–100 delay-risk score, the exact reasons behind it, and advice on
  when to check in.
- **Browse the live dashboard.** A world map of every monitored airport, color-coded by
  risk, refreshing automatically. Click any airport for the raw weather report and the
  full breakdown of its score.

Everything updates itself. A background worker re-checks every airport every 10 minutes,
with no one watching it.

## How it works, in short

1. **Watch** — every 10 minutes, fetch live weather for all airports (free public
   aviation-weather data, no API key).
2. **Score** — turn that weather into a 0–100 delay-risk number using the same rules real
   airline ops teams use (visibility, ceiling, wind, storms).
3. **Explain** — every score comes with the plain-English reasons behind it. No black box.
4. **Answer** — ask a question and an AI (Manus) reads the live data and writes you a
   real answer in seconds.

It's a weather-risk proxy, not a real flight-status feed — actual flight-delay data needs
a paid API this project doesn't use, and the site says so plainly rather than pretending
otherwise.

## Run it yourself

```bash
cd frontend
npm install
npm run dev
```

That's it — with no further setup it runs on realistic mock data, so you can see the
whole UI immediately. To point it at the real live backend, see [Full setup](#full-setup)
below.

## Project layout

```
worker/      the autonomous agent (Python, runs on Modal)
supabase/    database schema (Postgres)
frontend/    the website (React + TypeScript)
```

## Full setup

<details>
<summary>Click to expand — wiring up the real backend (Supabase + Modal + optional Manus AI)</summary>

### 1. Supabase (the database)
1. Create a free project at [supabase.com](https://supabase.com).
2. Open the SQL editor and run [`supabase/schema.sql`](supabase/schema.sql).
3. Grab your Project URL, anon key, and service-role key from Settings → API.

### 2. Modal (the worker)
```bash
cd worker
pip install -r requirements.txt
modal secret create supabase-creds SUPABASE_URL=<url> SUPABASE_SERVICE_ROLE_KEY=<key>
modal secret create manus-creds MANUS_API_KEY=<your-manus-key>   # optional, for AI answers
pytest tests/
modal deploy app.py
```

### 3. Frontend, pointed at the real backend
```bash
cd frontend
cp .env.example .env.local   # fill in the values from steps 1 and 2
npm run dev
```

### 4. Deploying it publicly (optional)
```bash
cd frontend
npx vercel link
npx vercel env add VITE_SUPABASE_URL production
npx vercel env add VITE_SUPABASE_ANON_KEY production
npx vercel env add VITE_WORKER_BASE_URL production
npx vercel --prod
```

</details>

## Why it's built this way

- **No black box.** Every risk score lists the exact factors behind it, every forecast
  says so honestly when it doesn't have enough data to make a call.
- **Real data, real terms.** Same flight-category system (VFR/MVFR/IFR/LIFR) and delay
  drivers real airline ops teams use — and cost-of-delay figures sourced from Airlines
  for America and Eurocontrol, not made up.
- **Resilient by default.** Works fully on mock data with zero cloud accounts, and
  degrades gracefully (cached fallbacks, clear error messages) when a live dependency
  has a bad day.
- **Scoped honestly.** This is a deliberate slice of a much bigger original idea — built
  to be real and working end-to-end, not a mockup of something bigger.
