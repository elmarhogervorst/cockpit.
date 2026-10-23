-- Cockpit: Dokumentspeicher mit Eigentümer-Schutz.
-- Eine Tabelle bildet das bisherige Modell (Sammlung/Dokument-ID/Felder) eins zu eins ab.

create schema if not exists private;

-- Wer die Daten sehen und ändern darf. Bleibt leer, bis der Eigentümer festgelegt wird: dann ist nichts lesbar.
create table private.app_owner (
  user_id uuid primary key references auth.users (id) on delete cascade
);
alter table private.app_owner enable row level security;

create function private.is_owner()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from private.app_owner o where o.user_id = (select auth.uid())
  );
$$;

revoke all on function private.is_owner() from public, anon;
grant usage on schema private to authenticated;
grant execute on function private.is_owner() to authenticated;

create table public.docs (
  collection text  not null,
  id         text  not null,
  data       jsonb not null default '{}'::jsonb,
  version    integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (collection, id),
  constraint docs_data_is_object check (jsonb_typeof(data) = 'object')
);

alter table public.docs enable row level security;

create policy docs_owner_all on public.docs
  for all to authenticated
  using ((select private.is_owner()))
  with check ((select private.is_owner()));

-- Ohne Anmeldung kein Zugriff, auch nicht lesend.
revoke all on public.docs from anon, public;
grant select, insert, update, delete on public.docs to authenticated;

-- Version und Zeitstempel setzt allein die Datenbank.
create function private.docs_touch()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.version := 1;
    new.created_at := now();
    new.updated_at := now();
  else
    new.version := old.version + 1;
    new.updated_at := now();
    new.collection := old.collection;
    new.id := old.id;
    new.created_at := old.created_at;
  end if;
  return new;
end;
$$;

create trigger docs_touch
  before insert or update on public.docs
  for each row execute function private.docs_touch();

-- Teil-Aktualisierung wie bisher "update": Felder zusammenführen, {"__delete__": true} entfernt ein Feld.
create function public.merge_doc(
  p_collection text,
  p_id text,
  p_patch jsonb,
  p_if_version integer default null
)
returns public.docs
language plpgsql
security invoker
set search_path = ''
as $$
declare
  r public.docs;
  del jsonb := '{"__delete__": true}'::jsonb;
begin
  update public.docs d
     set data = (
           d.data || coalesce(
             (select jsonb_object_agg(e.k, e.v) from jsonb_each(p_patch) as e(k, v) where e.v <> del),
             '{}'::jsonb)
         ) - coalesce(
             (select array_agg(e.k) from jsonb_each(p_patch) as e(k, v) where e.v = del),
             array[]::text[])
   where d.collection = p_collection
     and d.id = p_id
     and (p_if_version is null or d.version = p_if_version)
  returning d.* into r;

  if not found then
    raise exception 'merge_doc: Dokument fehlt oder Version passt nicht (%/%)', p_collection, p_id
      using errcode = 'P0002';
  end if;
  return r;
end;
$$;

revoke all on function public.merge_doc(text, text, jsonb, integer) from public, anon;
grant execute on function public.merge_doc(text, text, jsonb, integer) to authenticated;

-- Live-Updates für die Oberfläche.
alter table public.docs replica identity full;
alter publication supabase_realtime add table public.docs;