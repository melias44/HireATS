-- Offer letter templates
create table if not exists offer_templates (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,           -- e.g. "Full-time Offer Letter"
  file_path   text not null,           -- path in Supabase Storage
  file_name   text not null,           -- original filename
  created_at  timestamptz default now(),
  created_by  uuid references auth.users(id) on delete set null
);

alter table offer_templates enable row level security;
create policy "Authenticated full access" on offer_templates
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- Add DocuSign tracking columns to offers table
alter table offers
  add column if not exists template_id uuid references offer_templates(id) on delete set null,
  add column if not exists docusign_envelope_id text,
  add column if not exists docusign_status text default 'not_sent',
  add column if not exists sent_at timestamptz,
  add column if not exists signed_at timestamptz;

-- Enable realtime for templates
alter publication supabase_realtime add table offer_templates;
