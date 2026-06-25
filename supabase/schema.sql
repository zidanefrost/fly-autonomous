-- OTP Sentinel — Supabase schema
-- Run this once in the Supabase SQL editor for a fresh project.

create table if not exists airports (
  icao text primary key,
  iata text,
  name text not null,
  city text,
  country text,
  lat double precision not null,
  lon double precision not null
);

create table if not exists weather_observations (
  icao text primary key references airports(icao),
  fetched_at timestamptz not null default now(),
  obs_time timestamptz,
  raw_metar text,
  flight_category text,
  wind_dir text,            -- numeric degrees or "VRB", stored as text to match source
  wind_speed_kt integer,
  wind_gust_kt integer,     -- null when not gusting (source omits the field entirely)
  visibility_sm text,       -- text since source is mixed type ("6+" or 4.35)
  weather_string text,
  clouds jsonb,
  is_stale boolean not null default false
);

create table if not exists delay_risk (
  icao text primary key references airports(icao),
  score integer not null check (score >= 0 and score <= 100),
  level text not null check (level in ('LOW', 'MEDIUM', 'HIGH', 'SEVERE')),
  factors jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

-- Row Level Security: public read-only. The worker writes with the
-- service-role key, which bypasses RLS entirely, so no write policy is needed.
alter table airports enable row level security;
alter table weather_observations enable row level security;
alter table delay_risk enable row level security;

create policy "public read airports" on airports for select using (true);
create policy "public read weather" on weather_observations for select using (true);
create policy "public read risk" on delay_risk for select using (true);

-- Required for Supabase Realtime push — RLS alone does not enable this.
alter publication supabase_realtime add table weather_observations;
alter publication supabase_realtime add table delay_risk;

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

-- No RLS policies on purpose: holds phone numbers (PII). Zero policies +
-- RLS enabled means no anon/authenticated access at all; only the worker
-- (service-role key, bypasses RLS) reads or writes it.
alter table flight_watches enable row level security;

-- Seed data: ~100 popular airports worldwide, excluding the USA and Russia.
-- Mirrors worker/airports_seed.py — keep both in sync if the list changes.
insert into airports (icao, iata, name, city, country, lat, lon) values
  ('EGLL', 'LHR', 'London Heathrow', 'London', 'United Kingdom', 51.4775, -0.4614),
  ('EGKK', 'LGW', 'London Gatwick', 'London', 'United Kingdom', 51.1537, -0.1821),
  ('LFPG', 'CDG', 'Paris Charles de Gaulle', 'Paris', 'France', 49.0097, 2.5479),
  ('LFPO', 'ORY', 'Paris Orly', 'Paris', 'France', 48.7233, 2.3794),
  ('LFMN', 'NCE', 'Nice Côte d''Azur', 'Nice', 'France', 43.6584, 7.2159),
  ('EHAM', 'AMS', 'Amsterdam Schiphol', 'Amsterdam', 'Netherlands', 52.3105, 4.7683),
  ('EDDF', 'FRA', 'Frankfurt', 'Frankfurt', 'Germany', 50.0379, 8.5622),
  ('EDDM', 'MUC', 'Munich', 'Munich', 'Germany', 48.3537, 11.786),
  ('EDDB', 'BER', 'Berlin Brandenburg', 'Berlin', 'Germany', 52.3667, 13.5033),
  ('EDDH', 'HAM', 'Hamburg', 'Hamburg', 'Germany', 53.6304, 9.9882),
  ('LEMD', 'MAD', 'Madrid Barajas', 'Madrid', 'Spain', 40.4983, -3.5676),
  ('LEBL', 'BCN', 'Barcelona', 'Barcelona', 'Spain', 41.2974, 2.0833),
  ('LEPA', 'PMI', 'Palma de Mallorca', 'Palma', 'Spain', 39.5517, 2.7388),
  ('LIRF', 'FCO', 'Rome Fiumicino', 'Rome', 'Italy', 41.8003, 12.2389),
  ('LIMC', 'MXP', 'Milan Malpensa', 'Milan', 'Italy', 45.6306, 8.7281),
  ('LSZH', 'ZRH', 'Zurich', 'Zurich', 'Switzerland', 47.4647, 8.5492),
  ('LOWW', 'VIE', 'Vienna', 'Vienna', 'Austria', 48.1103, 16.5697),
  ('EBBR', 'BRU', 'Brussels', 'Brussels', 'Belgium', 50.9014, 4.4844),
  ('LPPT', 'LIS', 'Lisbon', 'Lisbon', 'Portugal', 38.7813, -9.1359),
  ('EKCH', 'CPH', 'Copenhagen', 'Copenhagen', 'Denmark', 55.618, 12.656),
  ('ESSA', 'ARN', 'Stockholm Arlanda', 'Stockholm', 'Sweden', 59.6519, 17.9186),
  ('ENGM', 'OSL', 'Oslo Gardermoen', 'Oslo', 'Norway', 60.1976, 11.1004),
  ('EFHK', 'HEL', 'Helsinki', 'Helsinki', 'Finland', 60.3172, 24.9633),
  ('EIDW', 'DUB', 'Dublin', 'Dublin', 'Ireland', 53.4213, -6.2701),
  ('LKPR', 'PRG', 'Prague', 'Prague', 'Czech Republic', 50.1008, 14.26),
  ('EPWA', 'WAW', 'Warsaw', 'Warsaw', 'Poland', 52.1657, 20.9671),
  ('LHBP', 'BUD', 'Budapest', 'Budapest', 'Hungary', 47.4298, 19.2611),
  ('LTFM', 'IST', 'Istanbul Airport', 'Istanbul', 'Turkey', 41.2753, 28.7519),
  ('LGAV', 'ATH', 'Athens', 'Athens', 'Greece', 37.9364, 23.9445),
  ('OMDB', 'DXB', 'Dubai Intl', 'Dubai', 'United Arab Emirates', 25.2532, 55.3657),
  ('OMAA', 'AUH', 'Abu Dhabi', 'Abu Dhabi', 'United Arab Emirates', 24.433, 54.6511),
  ('OTHH', 'DOH', 'Doha Hamad', 'Doha', 'Qatar', 25.2731, 51.608),
  ('OERK', 'RUH', 'Riyadh King Khalid', 'Riyadh', 'Saudi Arabia', 24.9576, 46.6988),
  ('OEJN', 'JED', 'Jeddah King Abdulaziz', 'Jeddah', 'Saudi Arabia', 21.6796, 39.1565),
  ('OKBK', 'KWI', 'Kuwait City', 'Kuwait City', 'Kuwait', 29.2267, 47.9689),
  ('OBBI', 'BAH', 'Bahrain', 'Manama', 'Bahrain', 26.2708, 50.6336),
  ('OOMS', 'MCT', 'Muscat', 'Muscat', 'Oman', 23.5933, 58.2844),
  ('LLBG', 'TLV', 'Tel Aviv Ben Gurion', 'Tel Aviv', 'Israel', 32.0114, 34.8867),
  ('OJAI', 'AMM', 'Amman Queen Alia', 'Amman', 'Jordan', 31.7226, 35.9932),
  ('OLBA', 'BEY', 'Beirut Rafic Hariri', 'Beirut', 'Lebanon', 33.8209, 35.4884),
  ('VHHH', 'HKG', 'Hong Kong Intl', 'Hong Kong', 'Hong Kong', 22.308, 113.9185),
  ('WSSS', 'SIN', 'Singapore Changi', 'Singapore', 'Singapore', 1.3644, 103.9915),
  ('RJTT', 'HND', 'Tokyo Haneda', 'Tokyo', 'Japan', 35.5494, 139.7798),
  ('RJAA', 'NRT', 'Tokyo Narita', 'Tokyo', 'Japan', 35.7647, 140.3864),
  ('RJBB', 'KIX', 'Osaka Kansai', 'Osaka', 'Japan', 34.4347, 135.244),
  ('RKSI', 'ICN', 'Seoul Incheon', 'Seoul', 'South Korea', 37.4602, 126.4407),
  ('ZBAA', 'PEK', 'Beijing Capital', 'Beijing', 'China', 40.0801, 116.5846),
  ('ZBAD', 'PKX', 'Beijing Daxing', 'Beijing', 'China', 39.5098, 116.4105),
  ('ZSPD', 'PVG', 'Shanghai Pudong', 'Shanghai', 'China', 31.1443, 121.8083),
  ('ZSSS', 'SHA', 'Shanghai Hongqiao', 'Shanghai', 'China', 31.1979, 121.3363),
  ('ZGGG', 'CAN', 'Guangzhou Baiyun', 'Guangzhou', 'China', 23.3924, 113.2988),
  ('ZGSZ', 'SZX', 'Shenzhen Bao''an', 'Shenzhen', 'China', 22.6393, 113.8107),
  ('ZPPP', 'KMG', 'Kunming Changshui', 'Kunming', 'China', 25.1019, 102.9293),
  ('VTBS', 'BKK', 'Bangkok Suvarnabhumi', 'Bangkok', 'Thailand', 13.69, 100.7501),
  ('VTBD', 'DMK', 'Bangkok Don Mueang', 'Bangkok', 'Thailand', 13.9126, 100.6068),
  ('WMKK', 'KUL', 'Kuala Lumpur', 'Kuala Lumpur', 'Malaysia', 2.7456, 101.7099),
  ('WIII', 'CGK', 'Jakarta Soekarno-Hatta', 'Jakarta', 'Indonesia', -6.1256, 106.6559),
  ('RPLL', 'MNL', 'Manila Ninoy Aquino', 'Manila', 'Philippines', 14.5086, 121.0194),
  ('RCTP', 'TPE', 'Taipei Taoyuan', 'Taipei', 'Taiwan', 25.0777, 121.2328),
  ('VVNB', 'HAN', 'Hanoi Noi Bai', 'Hanoi', 'Vietnam', 21.2212, 105.8072),
  ('VVTS', 'SGN', 'Ho Chi Minh City', 'Ho Chi Minh City', 'Vietnam', 10.8188, 106.652),
  ('VIDP', 'DEL', 'Delhi Indira Gandhi', 'Delhi', 'India', 28.5562, 77.1),
  ('VABB', 'BOM', 'Mumbai Chhatrapati Shivaji', 'Mumbai', 'India', 19.0887, 72.8679),
  ('VOBL', 'BLR', 'Bangalore Kempegowda', 'Bangalore', 'India', 13.1986, 77.7066),
  ('VOMM', 'MAA', 'Chennai', 'Chennai', 'India', 12.9941, 80.1709),
  ('VECC', 'CCU', 'Kolkata', 'Kolkata', 'India', 22.6547, 88.4467),
  ('VOHS', 'HYD', 'Hyderabad Rajiv Gandhi', 'Hyderabad', 'India', 17.2403, 78.4294),
  ('VNKT', 'KTM', 'Kathmandu Tribhuvan', 'Kathmandu', 'Nepal', 27.6966, 85.3591),
  ('VCBI', 'CMB', 'Colombo Bandaranaike', 'Colombo', 'Sri Lanka', 7.1808, 79.8841),
  ('VGHS', 'DAC', 'Dhaka Hazrat Shahjalal', 'Dhaka', 'Bangladesh', 23.8433, 90.3978),
  ('OPKC', 'KHI', 'Karachi Jinnah', 'Karachi', 'Pakistan', 24.9065, 67.1608),
  ('OPLA', 'LHE', 'Lahore Allama Iqbal', 'Lahore', 'Pakistan', 31.5216, 74.4036),
  ('YSSY', 'SYD', 'Sydney Kingsford Smith', 'Sydney', 'Australia', -33.9461, 151.1772),
  ('YMML', 'MEL', 'Melbourne', 'Melbourne', 'Australia', -37.669, 144.841),
  ('YBBN', 'BNE', 'Brisbane', 'Brisbane', 'Australia', -27.3942, 153.1218),
  ('YPPH', 'PER', 'Perth', 'Perth', 'Australia', -31.9403, 115.9669),
  ('NZAA', 'AKL', 'Auckland', 'Auckland', 'New Zealand', -37.0082, 174.785),
  ('HECA', 'CAI', 'Cairo Intl', 'Cairo', 'Egypt', 30.1219, 31.4056),
  ('FACT', 'CPT', 'Cape Town', 'Cape Town', 'South Africa', -33.9649, 18.6017),
  ('FAOR', 'JNB', 'Johannesburg O.R. Tambo', 'Johannesburg', 'South Africa', -26.1392, 28.246),
  ('GMMN', 'CMN', 'Casablanca Mohammed V', 'Casablanca', 'Morocco', 33.3675, -7.59),
  ('HKJK', 'NBO', 'Nairobi Jomo Kenyatta', 'Nairobi', 'Kenya', -1.3192, 36.9278),
  ('HAAB', 'ADD', 'Addis Ababa Bole', 'Addis Ababa', 'Ethiopia', 8.9779, 38.7993),
  ('DNMM', 'LOS', 'Lagos Murtala Muhammed', 'Lagos', 'Nigeria', 6.5774, 3.3212),
  ('DGAA', 'ACC', 'Accra Kotoka', 'Accra', 'Ghana', 5.6052, -0.1668),
  ('DAAG', 'ALG', 'Algiers Houari Boumediene', 'Algiers', 'Algeria', 36.691, 3.2154),
  ('DTTA', 'TUN', 'Tunis Carthage', 'Tunis', 'Tunisia', 36.851, 10.2272),
  ('CYYZ', 'YYZ', 'Toronto Pearson', 'Toronto', 'Canada', 43.6777, -79.6248),
  ('CYVR', 'YVR', 'Vancouver', 'Vancouver', 'Canada', 49.1939, -123.1844),
  ('CYUL', 'YUL', 'Montreal Trudeau', 'Montreal', 'Canada', 45.4706, -73.7408),
  ('CYYC', 'YYC', 'Calgary', 'Calgary', 'Canada', 51.1315, -114.0106),
  ('MMMX', 'MEX', 'Mexico City', 'Mexico City', 'Mexico', 19.4363, -99.0721),
  ('MMUN', 'CUN', 'Cancun', 'Cancun', 'Mexico', 21.0365, -86.8771),
  ('MMGL', 'GDL', 'Guadalajara', 'Guadalajara', 'Mexico', 20.5218, -103.3107),
  ('SBGR', 'GRU', 'São Paulo Guarulhos', 'São Paulo', 'Brazil', -23.4356, -46.4731),
  ('SBGL', 'GIG', 'Rio de Janeiro Galeão', 'Rio de Janeiro', 'Brazil', -22.809, -43.2436),
  ('SAEZ', 'EZE', 'Buenos Aires Ezeiza', 'Buenos Aires', 'Argentina', -34.8222, -58.5358),
  ('SCEL', 'SCL', 'Santiago', 'Santiago', 'Chile', -33.393, -70.7858),
  ('SKBO', 'BOG', 'Bogotá El Dorado', 'Bogotá', 'Colombia', 4.7016, -74.1469),
  ('SPJC', 'LIM', 'Lima Jorge Chávez', 'Lima', 'Peru', -12.0219, -77.1143),
  ('MPTO', 'PTY', 'Panama City Tocumen', 'Panama City', 'Panama', 9.0714, -79.3835),
  ('MROC', 'SJO', 'San José Juan Santamaría', 'San José', 'Costa Rica', 9.9939, -84.2088)
on conflict (icao) do nothing;
