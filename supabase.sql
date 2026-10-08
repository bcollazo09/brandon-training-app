-- Free Supabase backend: public reads are owner-scoped; writes use one revision-checked RPC.
-- Run once in a fresh project through an audited migration. No private key is used by the app.
create table public.fitness_state (
 user_id uuid primary key references auth.users(id) on delete cascade,
 revision bigint not null check (revision > 0),
 payload jsonb not null,
 updated_at timestamptz not null default now()
);
create table public.fitness_snapshots (
 user_id uuid not null references auth.users(id) on delete cascade,
 revision bigint not null check (revision > 0),
 payload jsonb not null,
 created_at timestamptz not null default now(),
 primary key (user_id, revision)
);
alter table public.fitness_state enable row level security;
alter table public.fitness_snapshots enable row level security;
create policy owner_read on public.fitness_state for select to authenticated using ((select auth.uid()) = user_id);
create policy owner_read on public.fitness_snapshots for select to authenticated using ((select auth.uid()) = user_id);
revoke all on public.fitness_state, public.fitness_snapshots from public, anon, authenticated;
grant select on public.fitness_state, public.fitness_snapshots to authenticated;

-- The privileged implementation stays outside the exposed API schema. Its owner is
-- derived exclusively from the authenticated request, never a client-supplied ID.
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;
create function private.fitness_save(expected_revision bigint, document jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare owner uuid := auth.uid(); current_revision bigint; next_revision bigint;
begin
 if owner is null then raise exception 'Authentication required'; end if;
 if expected_revision is null or expected_revision < 0 then raise exception 'Revision required'; end if;
 if document is null or jsonb_typeof(document) is distinct from 'object'
    or document->>'version' is distinct from '5'
    or jsonb_typeof(document->'workouts') is distinct from 'array'
    or octet_length(document::text) > 10000000 then raise exception 'Invalid document'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(owner::text, 0));
 select revision into current_revision from public.fitness_state where user_id = owner;
 current_revision := coalesce(current_revision, 0);
 if current_revision <> expected_revision then
  return jsonb_build_object('conflict', true, 'revision', current_revision);
 end if;
 next_revision := current_revision + 1;
 insert into public.fitness_state(user_id, revision, payload) values(owner, next_revision, document)
 on conflict(user_id) do update set revision = next_revision, payload = document, updated_at = now();
 insert into public.fitness_snapshots(user_id, revision, payload) values(owner, next_revision, document);
 delete from public.fitness_snapshots where user_id = owner
 and revision not in (select revision from public.fitness_snapshots where user_id = owner order by revision desc limit 10)
 and revision not in (
  select max(revision) from public.fitness_snapshots where user_id = owner
  group by (created_at at time zone 'UTC')::date
  order by (created_at at time zone 'UTC')::date desc limit 30
 );
 return jsonb_build_object('conflict', false, 'revision', next_revision);
end $$;
revoke all on function private.fitness_save(bigint, jsonb) from public, anon, authenticated;
grant execute on function private.fitness_save(bigint, jsonb) to authenticated;

-- The public entry point runs with caller privileges and delegates only this operation.
create function public.fitness_save(expected_revision bigint, document jsonb)
returns jsonb language sql security invoker set search_path = '' as $$
 select private.fitness_save(expected_revision, document);
$$;
revoke all on function public.fitness_save(bigint, jsonb) from public, anon, authenticated;
grant execute on function public.fitness_save(bigint, jsonb) to authenticated;
