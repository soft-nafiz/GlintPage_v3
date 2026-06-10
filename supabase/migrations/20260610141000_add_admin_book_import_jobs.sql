create table if not exists public.admin_book_import_jobs (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null,
  query_title text not null,
  query_author text,
  status text not null default 'draft',
  metadata jsonb not null default '{}'::jsonb,
  candidates jsonb not null default '[]'::jsonb,
  selected_candidate jsonb,
  source_provider text,
  source_url text,
  book_id uuid references public.books(id) on delete set null,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint admin_book_import_jobs_status_check check (
    status in (
      'draft',
      'metadata_found',
      'source_found',
      'manual_upload_required',
      'approved',
      'downloading',
      'queued_for_processing',
      'completed',
      'failed'
    )
  )
);

create index if not exists admin_book_import_jobs_admin_created_idx
  on public.admin_book_import_jobs (admin_id, created_at desc);

create index if not exists admin_book_import_jobs_status_idx
  on public.admin_book_import_jobs (status, updated_at desc);
