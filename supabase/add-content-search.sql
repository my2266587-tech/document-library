-- =====================================================================
-- חיפוש בתוך תוכן המסמכים (טקסט שזוהה מתמונות)
-- Run once in Supabase Studio → SQL Editor. Safe to run more than once.
-- =====================================================================

-- Text read from the document (one paragraph per line).
alter table documents_library add column if not exists content_text text;

-- When the text was read. NULL = not read yet (the app reads it on demand).
alter table documents_library add column if not exists content_indexed_at timestamptz;

create extension if not exists pg_trgm;

create index if not exists documents_library_content_pending_idx
  on documents_library (content_indexed_at)
  where content_indexed_at is null;
