alter table public.book_user_lists enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'book_user_lists_user_id_fkey'
      and conrelid = 'public.book_user_lists'::regclass
  ) then
    alter table public.book_user_lists
      add constraint book_user_lists_user_id_fkey
      foreign key (user_id) references auth.users(id) on delete cascade;
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'book_user_lists'
      and policyname = 'Users can read their own book lists'
  ) then
    create policy "Users can read their own book lists"
      on public.book_user_lists
      for select
      to authenticated
      using (auth.uid() = user_id);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'book_user_lists'
      and policyname = 'Users can add books to their own lists'
  ) then
    create policy "Users can add books to their own lists"
      on public.book_user_lists
      for insert
      to authenticated
      with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'book_user_lists'
      and policyname = 'Users can remove books from their own lists'
  ) then
    create policy "Users can remove books from their own lists"
      on public.book_user_lists
      for delete
      to authenticated
      using (auth.uid() = user_id);
  end if;
end
$$;
