-- ============================================================
-- Originality Assistant — Initial Schema
-- Run this in the Supabase SQL Editor or via `supabase db push`
-- ============================================================

-- Enable UUID generation
create extension if not exists "uuid-ossp";

-- ─────────────────────────────────────────────
-- DOCUMENTS TABLE
-- Stores each uploaded assignment + optional bibliography
-- ─────────────────────────────────────────────
create table public.documents (
  id            uuid primary key default uuid_generate_v4(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  title         text not null,
  raw_text      text not null,
  bibliography_text text,
  created_at    timestamptz not null default now()
);

comment on table public.documents is 'Student-uploaded assignments for originality analysis';

-- Index for fast dashboard listing
create index idx_documents_user_id on public.documents(user_id);

-- ─────────────────────────────────────────────
-- REPORTS TABLE
-- Stores the structured analysis output per document
-- ─────────────────────────────────────────────
create table public.reports (
  id            uuid primary key default uuid_generate_v4(),
  document_id   uuid not null references public.documents(id) on delete cascade,
  created_at    timestamptz not null default now(),
  report_data   jsonb not null default '[]'::jsonb
);

comment on table public.reports is 'Analysis reports with structured findings (JSONB)';

create index idx_reports_document_id on public.reports(document_id);

-- ─────────────────────────────────────────────
-- ROW LEVEL SECURITY
-- ─────────────────────────────────────────────

alter table public.documents enable row level security;
alter table public.reports  enable row level security;

-- Documents: users can only access their own rows
create policy "Users can view own documents"
  on public.documents for select
  using (auth.uid() = user_id);

create policy "Users can insert own documents"
  on public.documents for insert
  with check (auth.uid() = user_id);

create policy "Users can update own documents"
  on public.documents for update
  using (auth.uid() = user_id);

create policy "Users can delete own documents"
  on public.documents for delete
  using (auth.uid() = user_id);

-- Reports: users can access reports for documents they own
create policy "Users can view own reports"
  on public.reports for select
  using (
    exists (
      select 1 from public.documents
      where documents.id = reports.document_id
        and documents.user_id = auth.uid()
    )
  );

create policy "Users can insert own reports"
  on public.reports for insert
  with check (
    exists (
      select 1 from public.documents
      where documents.id = reports.document_id
        and documents.user_id = auth.uid()
    )
  );

create policy "Users can update own reports"
  on public.reports for update
  using (
    exists (
      select 1 from public.documents
      where documents.id = reports.document_id
        and documents.user_id = auth.uid()
    )
  );

create policy "Users can delete own reports"
  on public.reports for delete
  using (
    exists (
      select 1 from public.documents
      where documents.id = reports.document_id
        and documents.user_id = auth.uid()
    )
  );
