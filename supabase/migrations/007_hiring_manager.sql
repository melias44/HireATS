-- Add hiring manager to jobs
alter table jobs
  add column if not exists hiring_manager_id uuid references auth.users;

-- Expand roles to include hiring_manager
alter table profiles
  drop constraint if exists profiles_role_check;
alter table profiles
  add constraint profiles_role_check
  check (role in ('admin', 'member', 'hiring_manager'));
