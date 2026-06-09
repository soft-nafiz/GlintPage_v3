alter table public.book_pages
  add column if not exists render_type text not null default 'markdown',
  add column if not exists render_content text,
  add column if not exists ai_text text,
  add column if not exists asset_manifest jsonb not null default '{}'::jsonb;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'book_pages_render_type_check'
      and conrelid = 'public.book_pages'::regclass
  ) then
    alter table public.book_pages
      add constraint book_pages_render_type_check
      check (render_type in ('markdown', 'epub_xhtml', 'pdf_image'))
      not valid;
  end if;
end $$;

alter table public.book_pages validate constraint book_pages_render_type_check;
