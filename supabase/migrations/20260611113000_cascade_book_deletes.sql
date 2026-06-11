do $$
declare
  constraint_name text;
begin
  if to_regclass('public.book_pages') is not null then
    for constraint_name in
      select c.conname
      from pg_constraint c
      join pg_class t on t.oid = c.conrelid
      join pg_namespace n on n.oid = t.relnamespace
      join unnest(c.conkey) column_number on true
      join pg_attribute a on a.attrelid = t.oid and a.attnum = column_number
      where n.nspname = 'public'
        and t.relname = 'book_pages'
        and c.contype = 'f'
        and a.attname = 'book_id'
    loop
      execute format('alter table public.book_pages drop constraint %I', constraint_name);
    end loop;

    alter table public.book_pages
      add constraint book_pages_book_id_fkey
      foreign key (book_id) references public.books(id)
      on delete cascade
      not valid;
  end if;

  if to_regclass('public.reading_progress') is not null then
    for constraint_name in
      select c.conname
      from pg_constraint c
      join pg_class t on t.oid = c.conrelid
      join pg_namespace n on n.oid = t.relnamespace
      join unnest(c.conkey) column_number on true
      join pg_attribute a on a.attrelid = t.oid and a.attnum = column_number
      where n.nspname = 'public'
        and t.relname = 'reading_progress'
        and c.contype = 'f'
        and a.attname = 'book_id'
    loop
      execute format('alter table public.reading_progress drop constraint %I', constraint_name);
    end loop;

    alter table public.reading_progress
      add constraint reading_progress_book_id_fkey
      foreign key (book_id) references public.books(id)
      on delete cascade
      not valid;
  end if;

  if to_regclass('public.book_user_lists') is not null then
    for constraint_name in
      select c.conname
      from pg_constraint c
      join pg_class t on t.oid = c.conrelid
      join pg_namespace n on n.oid = t.relnamespace
      join unnest(c.conkey) column_number on true
      join pg_attribute a on a.attrelid = t.oid and a.attnum = column_number
      where n.nspname = 'public'
        and t.relname = 'book_user_lists'
        and c.contype = 'f'
        and a.attname = 'book_id'
    loop
      execute format('alter table public.book_user_lists drop constraint %I', constraint_name);
    end loop;

    alter table public.book_user_lists
      add constraint book_user_lists_book_id_fkey
      foreign key (book_id) references public.books(id)
      on delete cascade
      not valid;
  end if;

  if to_regclass('public.book_category_assignments') is not null then
    for constraint_name in
      select c.conname
      from pg_constraint c
      join pg_class t on t.oid = c.conrelid
      join pg_namespace n on n.oid = t.relnamespace
      join unnest(c.conkey) column_number on true
      join pg_attribute a on a.attrelid = t.oid and a.attnum = column_number
      where n.nspname = 'public'
        and t.relname = 'book_category_assignments'
        and c.contype = 'f'
        and a.attname = 'book_id'
    loop
      execute format('alter table public.book_category_assignments drop constraint %I', constraint_name);
    end loop;

    alter table public.book_category_assignments
      add constraint book_category_assignments_book_id_fkey
      foreign key (book_id) references public.books(id)
      on delete cascade
      not valid;
  end if;

  if to_regclass('public.chapter_summaries') is not null then
    for constraint_name in
      select c.conname
      from pg_constraint c
      join pg_class t on t.oid = c.conrelid
      join pg_namespace n on n.oid = t.relnamespace
      join unnest(c.conkey) column_number on true
      join pg_attribute a on a.attrelid = t.oid and a.attnum = column_number
      where n.nspname = 'public'
        and t.relname = 'chapter_summaries'
        and c.contype = 'f'
        and a.attname = 'book_id'
    loop
      execute format('alter table public.chapter_summaries drop constraint %I', constraint_name);
    end loop;

    alter table public.chapter_summaries
      add constraint chapter_summaries_book_id_fkey
      foreign key (book_id) references public.books(id)
      on delete cascade
      not valid;
  end if;

  if to_regclass('public.admin_book_import_jobs') is not null then
    for constraint_name in
      select c.conname
      from pg_constraint c
      join pg_class t on t.oid = c.conrelid
      join pg_namespace n on n.oid = t.relnamespace
      join unnest(c.conkey) column_number on true
      join pg_attribute a on a.attrelid = t.oid and a.attnum = column_number
      where n.nspname = 'public'
        and t.relname = 'admin_book_import_jobs'
        and c.contype = 'f'
        and a.attname = 'book_id'
    loop
      execute format('alter table public.admin_book_import_jobs drop constraint %I', constraint_name);
    end loop;

    alter table public.admin_book_import_jobs
      add constraint admin_book_import_jobs_book_id_fkey
      foreign key (book_id) references public.books(id)
      on delete set null
      not valid;
  end if;
end $$;

do $$
declare
  child_table text;
  constraint_name text;
begin
  foreach child_table in array array['translations', 'summaries', 'audio_pages']
  loop
    if to_regclass(format('public.%I', child_table)) is not null then
      for constraint_name in
        select c.conname
        from pg_constraint c
        join pg_class t on t.oid = c.conrelid
        join pg_namespace n on n.oid = t.relnamespace
        join unnest(c.conkey) column_number on true
        join pg_attribute a on a.attrelid = t.oid and a.attnum = column_number
        where n.nspname = 'public'
          and t.relname = child_table
          and c.contype = 'f'
          and a.attname = 'page_id'
      loop
        execute format('alter table public.%I drop constraint %I', child_table, constraint_name);
      end loop;

      execute format(
        'alter table public.%I add constraint %I foreign key (page_id) references public.book_pages(id) on delete cascade not valid',
        child_table,
        child_table || '_page_id_fkey'
      );
    end if;
  end loop;
end $$;

do $$
begin
  if to_regclass('public.book_pages') is not null then
    execute 'create index if not exists book_pages_book_id_idx on public.book_pages (book_id)';
  end if;

  if to_regclass('public.reading_progress') is not null then
    execute 'create index if not exists reading_progress_book_id_idx on public.reading_progress (book_id)';
  end if;

  if to_regclass('public.chapter_summaries') is not null then
    execute 'create index if not exists chapter_summaries_book_id_idx on public.chapter_summaries (book_id)';
  end if;

  if to_regclass('public.translations') is not null then
    execute 'create index if not exists translations_page_id_idx on public.translations (page_id)';
  end if;

  if to_regclass('public.summaries') is not null then
    execute 'create index if not exists summaries_page_id_idx on public.summaries (page_id)';
  end if;

  if to_regclass('public.audio_pages') is not null then
    execute 'create index if not exists audio_pages_page_id_idx on public.audio_pages (page_id)';
  end if;
end $$;
