-- =====================================================================
-- ספריית מסמכים — Supabase schema
-- Run this script in Supabase Studio → SQL Editor (one time setup)
-- =====================================================================

-- 1. Categories table -------------------------------------------------
create table if not exists document_categories (
  id          uuid        primary key default gen_random_uuid(),
  name        text        not null,
  description text,
  color       text,
  sort_order  integer     not null default 0,
  is_active   boolean     not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists document_categories_active_idx
  on document_categories (is_active, sort_order);

-- 2. Documents table --------------------------------------------------
create table if not exists documents_library (
  id                  uuid        primary key default gen_random_uuid(),
  title               text        not null,
  original_file_name  text        not null,
  file_path           text        not null,
  file_type           text,
  file_size           bigint,
  category_id         uuid        references document_categories(id) on delete set null,
  notes               text,
  patient_id          uuid,
  uploaded_by         text,
  is_archived         boolean     not null default false,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists documents_library_category_idx
  on documents_library (category_id);
create index if not exists documents_library_created_idx
  on documents_library (created_at desc);
create index if not exists documents_library_archived_idx
  on documents_library (is_archived);
create index if not exists documents_library_title_trgm_idx
  on documents_library using gin (title gin_trgm_ops);

-- Required extension for the trgm index (safe if already enabled)
create extension if not exists pg_trgm;

-- 3. updated_at trigger -----------------------------------------------
create or replace function touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists trg_document_categories_touch on document_categories;
create trigger trg_document_categories_touch
  before update on document_categories
  for each row execute function touch_updated_at();

drop trigger if exists trg_documents_library_touch on documents_library;
create trigger trg_documents_library_touch
  before update on documents_library
  for each row execute function touch_updated_at();

-- 4. Seed initial categories -----------------------------------------
insert into document_categories (name, sort_order)
values
  ('שדה חמד', 10),
  ('כללי',     20),
  ('אבחונים',  30),
  ('שונות',    40)
on conflict do nothing;

-- 5. RLS (optional, recommended) -------------------------------------
-- All API access in this project runs via the SERVICE ROLE on the server,
-- which bypasses RLS. We still enable RLS so that the anon/public role
-- cannot read or write anything from the browser.
alter table document_categories enable row level security;
alter table documents_library    enable row level security;
-- NOTE: deliberately no policies for anon/authenticated yet — server-only.
