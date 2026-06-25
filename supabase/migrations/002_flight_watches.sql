-- OTP Sentinel — flight_watches table
-- Run this once in the Supabase SQL editor (additive — safe on the existing
-- live project; also folded into supabase/schema.sql for fresh installs).

create table if not exists flight_watches (
  id uuid primary key default gen_random_uuid(),
  phone text not null,
  departure_icao text not null references airports(icao),
  arrival_icao text references airports(icao),
  departure_time timestamptz not null,
  wassist_conversation_id text,
  last_notified_level text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- No RLS policies on purpose: this table holds phone numbers (PII). Zero
-- policies + RLS enabled means anon/authenticated get no access at all; only
-- the worker (service-role key, bypasses RLS) ever reads or writes it. The
-- frontend never talks to this table directly — only through the
-- subscribe_flight_watch Modal endpoint.
alter table flight_watches enable row level security;
