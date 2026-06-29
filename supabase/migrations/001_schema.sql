-- ================================================================
-- Hire ATS — Initial Schema
-- Run this in Supabase: SQL Editor → New query → paste → Run
-- ================================================================

-- Jobs
create table if not exists jobs (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  dept        text,
  location    text,
  employment_type text,
  salary      text,
  description text,
  status      text default 'Draft' check (status in ('Draft','Active','Paused','Closed')),
  careers_published boolean default false,
  linkedin_published boolean default false,
  posted_at   timestamptz,
  created_at  timestamptz default now(),
  created_by  uuid references auth.users(id) on delete set null
);

-- Candidates
create table if not exists candidates (
  id          uuid primary key default gen_random_uuid(),
  fname       text not null,
  lname       text not null,
  email       text,
  source      text,
  priority    boolean default false,
  created_at  timestamptz default now(),
  created_by  uuid references auth.users(id) on delete set null
);

-- Applications — one row per (candidate × job)
create table if not exists applications (
  id           uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references candidates(id) on delete cascade,
  job_id       uuid not null references jobs(id) on delete cascade,
  stage        text default 'Applied'
                 check (stage in ('Applied','Phone Screen','Interview','Offer','Hired','Rejected')),
  applied_at   timestamptz default now(),
  unique (candidate_id, job_id)
);

-- Notes
create table if not exists notes (
  id              uuid primary key default gen_random_uuid(),
  candidate_id    uuid not null references candidates(id) on delete cascade,
  application_id  uuid references applications(id) on delete set null,
  job_title       text,   -- denormalized for display
  text            text not null,
  author_id       uuid references auth.users(id) on delete set null,
  author_name     text,
  created_at      timestamptz default now()
);

-- Interviews
create table if not exists interviews (
  id              uuid primary key default gen_random_uuid(),
  candidate_id    uuid not null references candidates(id) on delete cascade,
  job_id          uuid references jobs(id) on delete set null,
  candidate_name  text,   -- denormalized
  job_title       text,   -- denormalized
  interviewer     text,
  interview_type  text,
  scheduled_at    timestamptz,
  created_at      timestamptz default now()
);

-- Offers
create table if not exists offers (
  id           uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references candidates(id) on delete cascade,
  job_id       uuid references jobs(id) on delete set null,
  candidate_name text,  -- denormalized
  job_title    text,    -- denormalized
  salary       text,
  start_date   date,
  status       text default 'Pending'
                 check (status in ('Pending','Accepted','Declined')),
  letter_text  text,
  created_at   timestamptz default now()
);

-- ================================================================
-- Enable Row Level Security (all tables auth-gated)
-- ================================================================
alter table jobs         enable row level security;
alter table candidates   enable row level security;
alter table applications enable row level security;
alter table notes        enable row level security;
alter table interviews   enable row level security;
alter table offers       enable row level security;

-- Policy: any authenticated user can do everything
-- (tighten per-role later if needed)
create policy "Authenticated full access" on jobs
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "Authenticated full access" on candidates
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "Authenticated full access" on applications
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "Authenticated full access" on notes
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "Authenticated full access" on interviews
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "Authenticated full access" on offers
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- ================================================================
-- Enable Realtime on the tables that need live sync
-- ================================================================
alter publication supabase_realtime add table candidates;
alter publication supabase_realtime add table applications;
alter publication supabase_realtime add table notes;
alter publication supabase_realtime add table jobs;
alter publication supabase_realtime add table interviews;
alter publication supabase_realtime add table offers;
