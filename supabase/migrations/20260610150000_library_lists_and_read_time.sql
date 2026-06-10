alter table public.books
  add column if not exists total_read_seconds integer not null default 0;

alter table public.reading_progress
  add column if not exists total_read_seconds integer not null default 0;

create table if not exists public.book_user_lists (
  user_id uuid not null,
  book_id uuid not null references public.books(id) on delete cascade,
  list_type text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, book_id, list_type),
  constraint book_user_lists_type_check check (list_type in ('favorite', 'reading_list'))
);

create index if not exists book_user_lists_user_type_created_idx
  on public.book_user_lists (user_id, list_type, created_at desc);

create index if not exists books_public_total_read_seconds_idx
  on public.books (total_read_seconds desc)
  where is_public = true and status = 'completed';
