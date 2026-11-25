-- PrizeSpark phase 1 foundation.
-- Profiles (buyer / seller / admin), row level security, and an append-only
-- activity log with a hash chain.
--
-- Security model, in plain terms:
--   * A person can read and rename only their own profile.
--   * Nobody can change their own role from the API.
--   * Only an administrator, through set_user_role(), can change a role.
--   * That function writes the activity log in the same transaction.
--   * The activity log can be read by administrators only.
--   * Inserts into the log are rejected unless they come from write_audit_event().
--   * Updates, deletes, and truncates of the log are rejected for every role,
--     including the database owner, as long as the triggers stay enabled.

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------------
-- Profiles
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null unique,
  display_name text not null,
  role text not null default 'buyer' check (role in ('buyer', 'seller', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_display_name_length check (char_length(display_name) between 1 and 80)
);

comment on table public.profiles is
  'One row per account. role is buyer, seller, or admin. New accounts are buyers.';

create index profiles_role_idx on public.profiles (role);

alter table public.profiles enable row level security;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'admin'
  );
$$;

comment on function public.is_admin() is
  'True when the signed-in account has the admin role. Bypasses row security so policies can call it without looping.';

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated, service_role;

create or replace function public.profiles_before_insert()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.role is distinct from 'buyer'
     and current_setting('prizespark.allow_role_change', true) is distinct from '1' then
    raise exception 'new profiles must start as buyer'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger profiles_before_insert
  before insert on public.profiles
  for each row
  execute function public.profiles_before_insert();

create or replace function public.profiles_before_update()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.id is distinct from old.id then
    raise exception 'profile id cannot be changed'
      using errcode = '42501';
  end if;

  if new.email is distinct from old.email
     and current_setting('prizespark.allow_profile_email_change', true) is distinct from '1' then
    raise exception 'profile email cannot be changed from the app'
      using errcode = '42501';
  end if;

  if new.role is distinct from old.role
     and current_setting('prizespark.allow_role_change', true) is distinct from '1' then
    raise exception 'role cannot be changed directly'
      using errcode = '42501';
  end if;

  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_before_update
  before update on public.profiles
  for each row
  execute function public.profiles_before_update();

-- ---------------------------------------------------------------------------
-- Append-only activity log with a hash chain
-- ---------------------------------------------------------------------------

create sequence public.audit_chain_position;

create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  chain_position bigint not null unique,
  actor_id uuid,
  action text not null,
  entity_type text not null,
  entity_id text,
  before_state jsonb,
  after_state jsonb,
  created_at timestamptz not null default clock_timestamp(),
  prev_hash text not null,
  row_hash text not null,
  constraint audit_events_action_format check (action ~ '^[a-z0-9.]+$' and char_length(action) <= 80),
  constraint audit_events_entity_type_format check (entity_type ~ '^[a-z_]+$' and char_length(entity_type) <= 80),
  constraint audit_events_entity_id_length check (entity_id is null or char_length(entity_id) <= 200),
  constraint audit_events_prev_hash_format check (prev_hash ~ '^[0-9a-f]{64}$'),
  constraint audit_events_row_hash_format check (row_hash ~ '^[0-9a-f]{64}$')
);

comment on table public.audit_events is
  'Append-only activity log. Each row stores the hash of the previous row so a quiet edit can be detected.';

comment on column public.audit_events.before_state is 'JSON snapshot before the change. Null when there was no previous state.';
comment on column public.audit_events.after_state is 'JSON snapshot after the change.';
comment on column public.audit_events.prev_hash is 'row_hash of the previous event, or 64 zeroes for the first event.';
comment on column public.audit_events.row_hash is 'SHA-256 of the previous hash plus this row, as lowercase hex.';

alter table public.audit_events enable row level security;

create or replace function public.audit_row_hash(
  p_prev_hash text,
  p_chain_position bigint,
  p_id uuid,
  p_actor_id uuid,
  p_action text,
  p_entity_type text,
  p_entity_id text,
  p_before jsonb,
  p_after jsonb,
  p_created_at timestamptz
)
returns text
language sql
immutable
set search_path = public, extensions
as $$
  select encode(
    digest(
      convert_to(
        concat(
          p_prev_hash, '|',
          p_chain_position::text, '|',
          p_id::text, '|',
          coalesce(p_actor_id::text, ''), '|',
          p_action, '|',
          p_entity_type, '|',
          coalesce(p_entity_id, ''), '|',
          coalesce(p_before::text, 'null'), '|',
          coalesce(p_after::text, 'null'), '|',
          to_char(p_created_at at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')
        ),
        'UTF8'
      ),
      'sha256'
    ),
    'hex'
  );
$$;

create or replace function public.audit_events_before_insert()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  previous_hash text;
begin
  if current_setting('prizespark.audit_write', true) is distinct from '1' then
    raise exception 'audit_events can only be inserted by write_audit_event'
      using errcode = '42501';
  end if;

  if new.id is null then
    new.id := gen_random_uuid();
  end if;

  if new.created_at is null then
    new.created_at := clock_timestamp();
  end if;

  -- Serialize chain writers so two sign-ups cannot claim the same previous hash.
  perform pg_advisory_xact_lock(84264001);

  new.chain_position := nextval('public.audit_chain_position');

  select row_hash
    into previous_hash
  from public.audit_events
  order by chain_position desc
  limit 1;

  if previous_hash is null then
    previous_hash := repeat('0', 64);
  end if;

  new.prev_hash := previous_hash;
  new.row_hash := public.audit_row_hash(
    new.prev_hash,
    new.chain_position,
    new.id,
    new.actor_id,
    new.action,
    new.entity_type,
    new.entity_id,
    new.before_state,
    new.after_state,
    new.created_at
  );

  return new;
end;
$$;

create trigger audit_events_before_insert
  before insert on public.audit_events
  for each row
  execute function public.audit_events_before_insert();

create or replace function public.reject_audit_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'audit_events is append-only: % is not allowed', tg_op
    using errcode = '42501';
end;
$$;

create trigger audit_events_no_update
  before update on public.audit_events
  for each row
  execute function public.reject_audit_mutation();

create trigger audit_events_no_delete
  before delete on public.audit_events
  for each row
  execute function public.reject_audit_mutation();

create trigger audit_events_no_truncate
  before truncate on public.audit_events
  for each statement
  execute function public.reject_audit_mutation();

create or replace function public.write_audit_event(
  p_actor_id uuid,
  p_action text,
  p_entity_type text,
  p_entity_id text,
  p_before jsonb,
  p_after jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_id uuid;
begin
  if p_action is null or p_entity_type is null then
    raise exception 'action and entity type are required'
      using errcode = '22023';
  end if;

  perform set_config('prizespark.audit_write', '1', true);

  insert into public.audit_events (
    actor_id,
    action,
    entity_type,
    entity_id,
    before_state,
    after_state
  )
  values (
    p_actor_id,
    p_action,
    p_entity_type,
    p_entity_id,
    p_before,
    p_after
  )
  returning id into new_id;

  perform set_config('prizespark.audit_write', '0', true);

  return new_id;
end;
$$;

comment on function public.write_audit_event(uuid, text, text, text, jsonb, jsonb) is
  'The only supported way to add an activity-log row. Not granted to API roles.';

revoke all on function public.write_audit_event(uuid, text, text, text, jsonb, jsonb)
  from public, anon, authenticated, service_role;

create or replace function public.verify_audit_chain()
returns table (
  is_valid boolean,
  checked_count bigint,
  first_broken_id uuid
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  rec record;
  expected_prev text := repeat('0', 64);
  expected_hash text;
  seen bigint := 0;
begin
  if coalesce(auth.role(), '') is distinct from 'service_role' and not public.is_admin() then
    raise exception 'only an admin can verify the activity log'
      using errcode = '42501';
  end if;

  for rec in
    select *
    from public.audit_events
    order by chain_position asc
  loop
    seen := seen + 1;

    if rec.prev_hash is distinct from expected_prev then
      return query select false, seen, rec.id;
      return;
    end if;

    expected_hash := public.audit_row_hash(
      rec.prev_hash,
      rec.chain_position,
      rec.id,
      rec.actor_id,
      rec.action,
      rec.entity_type,
      rec.entity_id,
      rec.before_state,
      rec.after_state,
      rec.created_at
    );

    if rec.row_hash is distinct from expected_hash then
      return query select false, seen, rec.id;
      return;
    end if;

    expected_prev := rec.row_hash;
  end loop;

  return query select true, seen, null::uuid;
end;
$$;

revoke all on function public.verify_audit_chain() from public;
grant execute on function public.verify_audit_chain() to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Role changes (administrators only) and sign-up logging
-- ---------------------------------------------------------------------------

create or replace function public.set_user_role(
  target_user_id uuid,
  new_role text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  old_role text;
  target_email text;
  admin_count integer;
begin
  if actor is null or not public.is_admin() then
    raise exception 'only an admin can change roles'
      using errcode = '42501';
  end if;

  if new_role not in ('buyer', 'seller', 'admin') then
    raise exception 'invalid role'
      using errcode = '22023';
  end if;

  select role, email
    into old_role, target_email
  from public.profiles
  where id = target_user_id;

  if not found then
    raise exception 'user not found'
      using errcode = 'P0002';
  end if;

  if old_role = new_role then
    return;
  end if;

  if old_role = 'admin' and new_role is distinct from 'admin' then
    select count(*)
      into admin_count
    from public.profiles
    where role = 'admin';

    if admin_count <= 1 then
      raise exception 'cannot remove the last admin'
        using errcode = '42501';
    end if;
  end if;

  perform set_config('prizespark.allow_role_change', '1', true);

  update public.profiles
  set role = new_role
  where id = target_user_id;

  perform set_config('prizespark.allow_role_change', '0', true);

  perform public.write_audit_event(
    actor,
    'role.change',
    'profile',
    target_user_id::text,
    jsonb_build_object('role', old_role, 'email', target_email),
    jsonb_build_object('role', new_role, 'email', target_email)
  );
end;
$$;

comment on function public.set_user_role(uuid, text) is
  'Administrator-only role change. Writes an activity-log row in the same transaction.';

revoke all on function public.set_user_role(uuid, text) from public;
grant execute on function public.set_user_role(uuid, text) to authenticated;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  chosen_name text;
begin
  chosen_name := left(
    coalesce(
      nullif(trim(new.raw_user_meta_data->>'display_name'), ''),
      nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
      'Member'
    ),
    80
  );

  insert into public.profiles (id, email, display_name, role)
  values (new.id, coalesce(new.email, ''), chosen_name, 'buyer');

  perform public.write_audit_event(
    new.id,
    'user.signup',
    'profile',
    new.id::text,
    null,
    jsonb_build_object(
      'email', coalesce(new.email, ''),
      'role', 'buyer',
      'display_name', chosen_name
    )
  );

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

revoke all on function public.handle_new_user() from public, anon, authenticated, service_role;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'supabase_auth_admin') then
    grant execute on function public.handle_new_user() to supabase_auth_admin;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Privileges. Row security is not enough on its own: the API roles also need
-- to lack permission to write columns they must not touch.
-- ---------------------------------------------------------------------------

revoke all on table public.profiles from public, anon, authenticated, service_role;
revoke all on table public.audit_events from public, anon, authenticated, service_role;
revoke all on sequence public.audit_chain_position from public, anon, authenticated, service_role;

grant select on table public.profiles to authenticated;
grant update (display_name) on table public.profiles to authenticated;

grant select on table public.audit_events to authenticated;

-- service_role bypasses row security, so it does not get write grants either.
grant select on table public.profiles to service_role;
grant select on table public.audit_events to service_role;

create policy profiles_select_own
  on public.profiles
  for select
  to authenticated
  using (id = auth.uid());

create policy profiles_select_admin
  on public.profiles
  for select
  to authenticated
  using (public.is_admin());

create policy profiles_update_own
  on public.profiles
  for update
  to authenticated
  using (id = auth.uid())
  with check (
    id = auth.uid()
    and role = (
      select p.role
      from public.profiles p
      where p.id = auth.uid()
    )
  );

create policy audit_events_select_admin
  on public.audit_events
  for select
  to authenticated
  using (public.is_admin());

-- No insert, update, or delete policies. Those statements are denied for
-- API roles even before the triggers reject them.
