-- Mahlzeiten ändern und löschen (für Claude, z. B. den Skill "logge-essen").
--
-- Seit dieser Änderung zeigt die Seite Mahlzeiten nur noch an. Eintragen (log_meal), ändern (update_meal) und löschen
-- (delete_meal) geht allein über diese Datenbankfunktionen. Sie laufen wie log_meal mit den Rechten des Aufrufers
-- (security invoker), es gelten also dieselben Zugriffsregeln wie für die Tabelle.
--
-- Eine Mahlzeit wird über Tag und id angesprochen (days/<Datum>.meals[].id). id und Eintragszeit (at) bleiben beim Ändern
-- erhalten, die Reihenfolge der Mahlzeiten am Tag auch.

-- Summe aller Mahlzeiten eines Tages, gerundet wie in der Seite (kcal ganzzahlig, Makros eine Nachkommastelle).
create function private.meals_sum(p_meals jsonb)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select jsonb_build_object(
           'kcal',    coalesce(round(sum((m->>'kcal')::numeric)), 0),
           'protein', coalesce(trim_scale(round(sum((m->>'protein')::numeric), 1)), 0),
           'carbs',   coalesce(trim_scale(round(sum((m->>'carbs')::numeric), 1)), 0),
           'fat',     coalesce(trim_scale(round(sum((m->>'fat')::numeric), 1)), 0))
    from jsonb_array_elements(case when jsonb_typeof(p_meals) = 'array' then p_meals else '[]'::jsonb end) as m;
$$;

revoke all on function private.meals_sum(jsonb) from public, anon;
grant execute on function private.meals_sum(jsonb) to authenticated;

-- Mahlzeit ändern.
--   p_meal hat dasselbe Format wie bei log_meal. Es gilt:
--   * "name" fehlt oder ist leer: der bisherige Name bleibt.
--   * Weder "ingredients" noch kcal/protein/carbs/fat angegeben: nur der Name wird geändert, Werte und Zutaten bleiben.
--   * "ingredients" angegeben (nicht leer): die Zutatenliste wird komplett ersetzt, kcal und Makros ergeben sich aus der Summe.
--   * Nur kcal/protein/carbs/fat angegeben: die Werte werden ersetzt, eine bisherige Zutatenliste entfällt.
--   Wer eine einzelne Zutat ändern will, liest die Mahlzeit, ändert die Liste und gibt sie vollständig zurück.
create function public.update_meal(p_day date, p_meal_id text, p_meal jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_day   text;
  v_meals jsonb;
  v_pos   integer;
  v_old   jsonb;
  v_new   jsonb;
  v_name  text;
  v_ing   jsonb;
  v_sum   jsonb;
  r       public.docs;
begin
  if p_day is null or coalesce(btrim(p_meal_id), '') = '' then
    raise exception 'update_meal: Tag und id der Mahlzeit sind Pflicht' using errcode = '22023';
  end if;
  if jsonb_typeof(p_meal) is distinct from 'object' then
    raise exception 'update_meal: die Mahlzeit muss ein JSON-Objekt sein' using errcode = '22023';
  end if;
  v_day := to_char(p_day, 'YYYY-MM-DD');

  select d.data->'meals' into v_meals
    from public.docs d
   where d.collection = 'days' and d.id = v_day
   for update;
  select e.ord - 1, e.v into v_pos, v_old
    from jsonb_array_elements(case when jsonb_typeof(v_meals) = 'array' then v_meals else '[]'::jsonb end) with ordinality as e(v, ord)
   where e.v->>'id' = p_meal_id;
  if v_pos is null then
    raise exception 'update_meal: keine Mahlzeit mit id % am %', p_meal_id, v_day using errcode = 'P0002';
  end if;

  v_name := coalesce(nullif(btrim(coalesce(p_meal->>'name', '')), ''), v_old->>'name');

  if jsonb_typeof(p_meal->'ingredients') = 'array' and jsonb_array_length(p_meal->'ingredients') > 0 then
    select jsonb_agg(
             jsonb_build_object('id', 'i' || substr(md5(random()::text || clock_timestamp()::text || e.ord::text), 1, 9))
             || private.meal_item(e.v, true)
             order by e.ord)
      into v_ing
      from jsonb_array_elements(p_meal->'ingredients') with ordinality as e(v, ord);
    select jsonb_build_object(
             'kcal',    round(sum((x->>'kcal')::numeric)),
             'protein', trim_scale(round(sum((x->>'protein')::numeric), 1)),
             'carbs',   trim_scale(round(sum((x->>'carbs')::numeric), 1)),
             'fat',     trim_scale(round(sum((x->>'fat')::numeric), 1)))
      into v_sum
      from jsonb_array_elements(v_ing) as x;
    v_new := (v_old - 'ingredients') || jsonb_build_object('name', v_name) || v_sum || jsonb_build_object('ingredients', v_ing);
  elsif p_meal ?| array['kcal', 'protein', 'carbs', 'fat'] then
    v_new := (v_old - 'ingredients')
             || private.meal_item(p_meal || jsonb_build_object('name', v_name), true);
  else
    v_new := v_old || jsonb_build_object('name', v_name);
  end if;

  update public.docs d
     set data = jsonb_set(d.data, array['meals', v_pos::text], v_new)
   where d.collection = 'days' and d.id = v_day
  returning * into r;

  return jsonb_build_object(
    'tag', v_day,
    'vorher', v_old,
    'eintrag', v_new,
    'eintraege_am_tag', jsonb_array_length(r.data->'meals'),
    'tagessumme', private.meals_sum(r.data->'meals'),
    'tagesziel', r.data->'targets'
  );
end;
$$;

revoke all on function public.update_meal(date, text, jsonb) from public, anon;
grant execute on function public.update_meal(date, text, jsonb) to authenticated;

-- Mahlzeit löschen. Gibt den gelöschten Eintrag zurück, damit er bei Bedarf mit log_meal wieder angelegt werden kann.
create function public.delete_meal(p_day date, p_meal_id text)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_day   text;
  v_meals jsonb;
  v_old   jsonb;
  r       public.docs;
begin
  if p_day is null or coalesce(btrim(p_meal_id), '') = '' then
    raise exception 'delete_meal: Tag und id der Mahlzeit sind Pflicht' using errcode = '22023';
  end if;
  v_day := to_char(p_day, 'YYYY-MM-DD');

  select d.data->'meals' into v_meals
    from public.docs d
   where d.collection = 'days' and d.id = v_day
   for update;
  select e.v into v_old
    from jsonb_array_elements(case when jsonb_typeof(v_meals) = 'array' then v_meals else '[]'::jsonb end) as e(v)
   where e.v->>'id' = p_meal_id;
  if v_old is null then
    raise exception 'delete_meal: keine Mahlzeit mit id % am %', p_meal_id, v_day using errcode = 'P0002';
  end if;

  update public.docs d
     set data = jsonb_set(d.data, '{meals}',
                  coalesce((select jsonb_agg(e.v order by e.ord)
                              from jsonb_array_elements(v_meals) with ordinality as e(v, ord)
                             where e.v->>'id' is distinct from p_meal_id), '[]'::jsonb))
   where d.collection = 'days' and d.id = v_day
  returning * into r;

  return jsonb_build_object(
    'tag', v_day,
    'geloescht', v_old,
    'eintraege_am_tag', jsonb_array_length(r.data->'meals'),
    'tagessumme', private.meals_sum(r.data->'meals'),
    'tagesziel', r.data->'targets'
  );
end;
$$;

revoke all on function public.delete_meal(date, text) from public, anon;
grant execute on function public.delete_meal(date, text) to authenticated;
