create table if not exists candidate_references (
  id           uuid default gen_random_uuid() primary key,
  candidate_id uuid references candidates on delete cascade not null,
  file_name    text not null,
  file_path    text not null,
  uploaded_by  uuid references auth.users,
  created_at   timestamptz default now()
);

alter table candidate_references enable row level security;

create policy "Authenticated users can manage references"
  on candidate_references for all
  using (auth.uid() is not null);
