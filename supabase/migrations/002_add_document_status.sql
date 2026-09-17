-- ============================================================
-- Add status column to documents table
-- Tracks whether analysis is pending, completed, or failed
-- ============================================================

-- Add status column with default 'pending'
alter table public.documents
  add column status text not null default 'pending';

-- Constrain to valid values
alter table public.documents
  add constraint documents_status_check
  check (status in ('pending', 'completed', 'failed'));

-- Backfill: documents that have a report are 'completed'
update public.documents
set status = 'completed'
where exists (
  select 1 from public.reports
  where reports.document_id = documents.id
);

-- Any remaining 'pending' documents older than 2 minutes are failed
-- (normal analysis completes in <30s; anything stuck longer is broken)
update public.documents
set status = 'failed'
where status = 'pending'
  and created_at < now() - interval '2 minutes';