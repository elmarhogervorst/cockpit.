-- Eigentümer festlegen: genau der eine vorhandene Nutzer.
do $$
declare n integer;
begin
  select count(*) into n from auth.users;
  if n <> 1 then
    raise exception 'Erwartet genau einen Nutzer, gefunden: %', n;
  end if;
  insert into private.app_owner (user_id) select id from auth.users;
end;
$$;

-- Zweite Absicherung neben dem Schalter im Dashboard: In der Datenbank kann kein weiterer Nutzer entstehen.
-- Soll später ein weiterer Nutzer angelegt werden, muss dieser Auslöser bewusst gelöscht werden.
create function private.block_new_users()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  raise exception 'Registrierung ist deaktiviert' using errcode = '42501';
end;
$$;

revoke all on function private.block_new_users() from public, anon, authenticated;

create trigger block_new_users
  before insert on auth.users
  for each row execute function private.block_new_users();