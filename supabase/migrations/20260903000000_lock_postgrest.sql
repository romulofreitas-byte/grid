-- Lock PostgREST: the app reads RF/enrichment via DATABASE_URL + pg, never the
-- anon key. JWT roles must not dump companies, cache, or billing tables.

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on all tables in schema public from anon';
    execute 'revoke all on all sequences in schema public from anon';
    execute 'revoke all on all functions in schema public from anon';
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'revoke all on all tables in schema public from authenticated';
    execute 'revoke all on all sequences in schema public from authenticated';
    execute 'revoke all on all functions in schema public from authenticated';
  end if;
  execute 'revoke all on all tables in schema public from public';
  execute 'revoke all on all sequences in schema public from public';
  execute 'revoke all on all functions in schema public from public';
end
$$;

alter default privileges in schema public
  revoke all on tables from public;
alter default privileges in schema public
  revoke all on sequences from public;
alter default privileges in schema public
  revoke all on functions from public;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'alter default privileges in schema public revoke all on tables from anon';
    execute 'alter default privileges in schema public revoke all on sequences from anon';
    execute 'alter default privileges in schema public revoke all on functions from anon';
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'alter default privileges in schema public revoke all on tables from authenticated';
    execute 'alter default privileges in schema public revoke all on sequences from authenticated';
    execute 'alter default privileges in schema public revoke all on functions from authenticated';
  end if;
  if exists (select 1 from pg_roles where rolname = 'postgres') then
    begin
      execute 'alter default privileges for role postgres in schema public revoke all on tables from public';
      if exists (select 1 from pg_roles where rolname = 'anon') then
        execute 'alter default privileges for role postgres in schema public revoke all on tables from anon';
      end if;
      if exists (select 1 from pg_roles where rolname = 'authenticated') then
        execute 'alter default privileges for role postgres in schema public revoke all on tables from authenticated';
      end if;
    exception
      when insufficient_privilege then
        null;
    end;
  end if;
  if exists (select 1 from pg_roles where rolname = 'supabase_admin') then
    begin
      execute 'alter default privileges for role supabase_admin in schema public revoke all on tables from public';
      if exists (select 1 from pg_roles where rolname = 'anon') then
        execute 'alter default privileges for role supabase_admin in schema public revoke all on tables from anon';
      end if;
      if exists (select 1 from pg_roles where rolname = 'authenticated') then
        execute 'alter default privileges for role supabase_admin in schema public revoke all on tables from authenticated';
      end if;
    exception
      when insufficient_privilege then
        null;
    end;
  end if;
end
$$;

do $$
declare
  r record;
begin
  for r in
    select tablename
    from pg_tables
    where schemaname = 'public'
  loop
    execute format('alter table public.%I enable row level security', r.tablename);
  end loop;
end
$$;

do $$
begin
  if to_regclass('public.lead_enrichment') is not null then
    drop policy if exists "lead_enrichment_read" on lead_enrichment;
  end if;
  if to_regclass('public.domain_cache') is not null then
    drop policy if exists "domain_cache_read" on domain_cache;
  end if;
end
$$;
