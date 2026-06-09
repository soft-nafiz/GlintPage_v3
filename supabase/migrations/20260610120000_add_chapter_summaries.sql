create table if not exists public.chapter_summaries (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references public.books(id) on delete cascade,
  chapter_number integer not null,
  chapter_title text,
  language_code text not null,
  source_first_page integer not null,
  source_last_page integer not null,
  summary_content text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists chapter_summaries_lookup_idx
  on public.chapter_summaries (
    book_id,
    chapter_number,
    language_code,
    source_first_page,
    source_last_page,
    created_at desc
  );

create unique index if not exists chapter_summaries_unique_source_idx
  on public.chapter_summaries (
    book_id,
    chapter_number,
    language_code,
    source_first_page,
    source_last_page
  );
