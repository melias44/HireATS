-- Add resume fields to candidates
alter table candidates
  add column if not exists phone text,
  add column if not exists linkedin text,
  add column if not exists location text,
  add column if not exists experience text,
  add column if not exists resume_path text,
  add column if not exists resume_name text;
