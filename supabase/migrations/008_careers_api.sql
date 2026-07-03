-- Migration 008: Careers page public API
-- Adds linkedin_url to candidates and opens job listings to anonymous reads

-- 1. Add LinkedIn URL field to candidates
alter table candidates
  add column if not exists linkedin_url text;

-- 2. Allow anonymous (unauthenticated) users to read Active jobs
--    This powers the careers page on the BDG website
create policy "Public can read active jobs"
  on jobs for select
  to anon
  using (status = 'Active');

-- 3. Allow anonymous users to insert new candidates
--    (applications submitted from the BDG careers page)
create policy "Public can submit candidates"
  on candidates for insert
  to anon
  with check (true);

-- 4. Allow anonymous users to insert applications
create policy "Public can submit applications"
  on applications for insert
  to anon
  with check (true);
