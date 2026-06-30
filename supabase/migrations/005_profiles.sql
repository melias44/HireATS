-- Team profiles with roles
create table if not exists profiles (
  id        uuid references auth.users on delete cascade primary key,
  email     text not null,
  full_name text,
  role      text not null default 'member' check (role in ('admin', 'member')),
  created_at timestamptz default now()
);

alter table profiles enable row level security;

create policy "Authenticated users can view all profiles"
  on profiles for select using (auth.uid() is not null);

create policy "Users can update own profile"
  on profiles for update using (auth.uid() = id);

-- Service role (Edge Functions) can do everything
create policy "Service role full access"
  on profiles for all using (auth.role() = 'service_role');

-- Auto-create profile when a user is invited or signs up
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce(new.raw_user_meta_data->>'role', 'member')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
