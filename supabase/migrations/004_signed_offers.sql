-- Add signed document storage to offers
alter table offers
  add column if not exists signed_document_path text,
  add column if not exists signed_at timestamptz;
