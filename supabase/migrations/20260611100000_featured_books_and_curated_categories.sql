alter table public.books
  add column if not exists is_featured boolean not null default false,
  add column if not exists featured_rank integer not null default 0,
  add column if not exists updated_at timestamptz not null default now();

create table if not exists public.library_categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.book_category_assignments (
  book_id uuid not null references public.books(id) on delete cascade,
  category_id uuid not null references public.library_categories(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (book_id, category_id)
);

create index if not exists books_public_featured_idx
  on public.books (featured_rank asc, created_at desc)
  where is_public = true and status = 'completed' and is_featured = true;

create index if not exists books_public_created_idx
  on public.books (created_at desc)
  where is_public = true and status = 'completed';

create index if not exists library_categories_active_order_idx
  on public.library_categories (is_active, sort_order asc, name asc);

create index if not exists book_category_assignments_category_idx
  on public.book_category_assignments (category_id, created_at desc);

create index if not exists book_category_assignments_book_idx
  on public.book_category_assignments (book_id);

alter table public.library_categories enable row level security;
alter table public.book_category_assignments enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'library_categories'
      and policyname = 'Anyone can read active library categories'
  ) then
    create policy "Anyone can read active library categories"
      on public.library_categories
      for select
      using (is_active = true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'book_category_assignments'
      and policyname = 'Anyone can read public book category assignments'
  ) then
    create policy "Anyone can read public book category assignments"
      on public.book_category_assignments
      for select
      using (
        exists (
          select 1
          from public.books
          where books.id = book_category_assignments.book_id
            and books.is_public = true
            and books.status = 'completed'
        )
      );
  end if;
end
$$;
