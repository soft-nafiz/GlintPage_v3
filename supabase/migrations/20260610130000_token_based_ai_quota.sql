alter table public.user_daily_usage
  add column if not exists translated_tokens integer not null default 0,
  add column if not exists summarized_tokens integer not null default 0;

alter table public.usage_logs
  add column if not exists requested_tokens integer,
  add column if not exists charged_tokens integer;

create or replace function public.get_daily_token_limit(user_plan text, action text)
returns integer
language plpgsql
stable
as $$
begin
  if action = 'translation' then
    return case coalesce(user_plan, 'free')
      when 'pro' then 63000
      when 'plus' then 27000
      when 'trial' then 27000
      when 'free' then 2700
      else 2700
    end;
  end if;

  if action = 'summary' then
    return case coalesce(user_plan, 'free')
      when 'pro' then 120000
      when 'plus' then 40000
      when 'trial' then 40000
      when 'free' then 4000
      else 4000
    end;
  end if;

  return 0;
end;
$$;

drop function if exists public.check_and_increment_usage(uuid, text);
drop function if exists public.check_and_increment_usage(uuid, text, integer);

create or replace function public.check_and_increment_usage(
  u_id uuid,
  action text,
  requested_tokens integer default 1
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  user_plan text;
  daily_limit integer;
  current_usage integer;
  requested integer;
  remaining_tokens integer;
  minimum_required integer;
  tokens_to_charge integer;
begin
  if action not in ('translation', 'summary') then
    return jsonb_build_object('allowed', false, 'reason', 'invalid_action');
  end if;

  select plan::text into user_plan
  from public.profiles
  where id = u_id;

  if user_plan is null then
    return jsonb_build_object('allowed', false, 'reason', 'user_not_found');
  end if;

  requested := greatest(coalesce(requested_tokens, 1), 1);
  daily_limit := public.get_daily_token_limit(user_plan, action);

  insert into public.user_daily_usage (user_id, usage_date)
  values (u_id, current_date)
  on conflict (user_id, usage_date) do nothing;

  select case action
    when 'translation' then translated_tokens
    when 'summary' then summarized_tokens
    else 0
  end into current_usage
  from public.user_daily_usage
  where user_id = u_id and usage_date = current_date
  for update;

  remaining_tokens := greatest(daily_limit - current_usage, 0);
  minimum_required := ceiling(requested * 0.35)::integer;

  if daily_limit <= 0 or remaining_tokens < minimum_required then
    return jsonb_build_object(
      'allowed', false,
      'reason', 'daily_limit_reached',
      'limit', daily_limit,
      'used', current_usage,
      'remaining', remaining_tokens,
      'requested_tokens', requested,
      'minimum_required_tokens', minimum_required
    );
  end if;

  tokens_to_charge := least(requested, remaining_tokens);

  update public.user_daily_usage
  set
    translated_tokens = translated_tokens + (
      case when action = 'translation' then tokens_to_charge else 0 end
    ),
    summarized_tokens = summarized_tokens + (
      case when action = 'summary' then tokens_to_charge else 0 end
    ),
    updated_at = now()
  where user_id = u_id and usage_date = current_date;

  insert into public.usage_logs (
    user_id,
    action_type,
    requested_tokens,
    charged_tokens
  )
  values (
    u_id,
    action::public.log_action_type,
    requested,
    tokens_to_charge
  );

  return jsonb_build_object(
    'allowed', true,
    'remaining', daily_limit - current_usage - tokens_to_charge,
    'limit', daily_limit,
    'used', current_usage + tokens_to_charge,
    'requested_tokens', requested,
    'charged_tokens', tokens_to_charge,
    'partial_charge', tokens_to_charge < requested
  );
end;
$$;

drop function if exists public.reverse_quota_deduction(uuid, text);
drop function if exists public.reverse_quota_deduction(uuid, text, integer);

create or replace function public.reverse_quota_deduction(
  u_id uuid,
  action text,
  charged_tokens integer default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_usage integer;
  tokens_to_refund integer;
  refunded_log_ctid tid;
begin
  if action not in ('translation', 'summary') then
    return jsonb_build_object('success', false, 'reason', 'invalid_action');
  end if;

  select case action
    when 'translation' then translated_tokens
    when 'summary' then summarized_tokens
    else 0
  end into current_usage
  from public.user_daily_usage
  where user_id = u_id and usage_date = current_date
  for update;

  if current_usage is null or current_usage <= 0 then
    return jsonb_build_object('success', false, 'reason', 'no_usage_to_rollback');
  end if;

  if charged_tokens is null then
    select ctid, coalesce(usage_logs.charged_tokens, 0)
    into refunded_log_ctid, tokens_to_refund
    from public.usage_logs
    where user_id = u_id
      and action_type = action::public.log_action_type
      and coalesce(usage_logs.charged_tokens, 0) > 0
    order by created_at desc
    limit 1;
  else
    tokens_to_refund := greatest(charged_tokens, 0);

    select ctid into refunded_log_ctid
    from public.usage_logs
    where user_id = u_id
      and action_type = action::public.log_action_type
      and charged_tokens = tokens_to_refund
    order by created_at desc
    limit 1;
  end if;

  if tokens_to_refund is null or tokens_to_refund <= 0 then
    return jsonb_build_object('success', false, 'reason', 'no_tokens_to_refund');
  end if;

  update public.user_daily_usage
  set
    translated_tokens = greatest(translated_tokens - (
      case when action = 'translation' then tokens_to_refund else 0 end
    ), 0),
    summarized_tokens = greatest(summarized_tokens - (
      case when action = 'summary' then tokens_to_refund else 0 end
    ), 0),
    updated_at = now()
  where user_id = u_id and usage_date = current_date;

  if refunded_log_ctid is not null then
    delete from public.usage_logs where ctid = refunded_log_ctid;
  end if;

  return jsonb_build_object(
    'success', true,
    'action_refunded', action,
    'refunded_tokens', tokens_to_refund,
    'new_used_tokens', greatest(current_usage - tokens_to_refund, 0)
  );
end;
$$;
