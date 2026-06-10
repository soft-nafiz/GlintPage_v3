alter table public.books
  add column if not exists description text,
  add column if not exists tags text[] not null default '{}'::text[],
  add column if not exists google_books_id text,
  add column if not exists gutenberg_id integer,
  add column if not exists source_provider text,
  add column if not exists source_url text,
  add column if not exists cover_source text,
  add column if not exists admin_created_by uuid;

create unique index if not exists books_public_gutenberg_id_unique_idx
  on public.books (gutenberg_id)
  where gutenberg_id is not null and is_public = true;

create unique index if not exists books_public_file_hash_unique_idx
  on public.books (file_hash)
  where file_hash is not null and is_public = true;

create unique index if not exists books_public_source_unique_idx
  on public.books (source_provider, source_url)
  where source_provider is not null and source_url is not null and is_public = true;

create index if not exists books_public_tags_idx
  on public.books using gin (tags);
