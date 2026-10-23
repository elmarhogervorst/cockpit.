-- Eine Mahlzeit in den Ernährungs-Tag eintragen (für Werkzeuge außerhalb der Seite, z. B. den Skill "logge-essen").
--
-- Die Funktion macht dasselbe wie das Formular im Reiter Ernährung:
--   * Mahlzeit {id, name, kcal, protein, carbs, fat, at} wird an days/<Datum>.meals angehängt, der Tag wird bei Bedarf angelegt.
--   * Mit "ingredients" (Liste von Zutaten) ergeben sich kcal und Makros aus der Summe der Zutaten, gerundet wie in der Seite
--     (kcal ganzzahlig, Makros auf eine Nachkommastelle).
--   * Fehlen kcal, werden sie aus den Makros berechnet (4/4/9), wie in der Seite.
--   * Ohne Datum gilt heute (Europe/Berlin). Erlaubt sind Tage von einem Jahr zurück bis 14 Tage voraus.
-- Sie läuft mit den Rechten des Aufrufers (security invoker): Es gelten dieselben Zugriffsregeln wie für die Tabelle.

-- Prüft und rundet einen Eintrag (Mahlzeit ohne Zutaten oder eine einzelne Zutat).
create function private.meal_item(p_item jsonb, p_need_name boolean)
returns jsonb
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_name text;
  v_k numeric;
  v_p numeric;
  v_c numeric;
  v_f numeric;
begin
  if jsonb_typeof(p_item) is distinct from 'object' then
    raise exception 'meal_item: erwartet wird ein JSON-Objekt' using errcode = '22023';
  end if;
  v_name := btrim(coalesce(p_item->>'name', ''));
  v_k := coalesce(nullif(p_item->>'kcal', '')::numeric, 0);
  v_p := coalesce(nullif(p_item->>'protein', '')::numeric, 0);
  v_c := coalesce(nullif(p_item->>'carbs', '')::numeric, 0);
  v_f := coalesce(nullif(p_item->>'fat', '')::numeric, 0);

  if p_need_name and v_name = '' then
    raise exception 'meal_item: Name fehlt' using errcode = '22023';
  end if;
  if v_k < 0 or v_p < 0 or v_c < 0 or v_f < 0 then
    raise exception 'meal_item: negative Werte bei "%"', v_name using errcode = '22023';
  end if;
  if v_k = 0 and (v_p > 0 or v_c > 0 or v_f > 0) then
    v_k := 4 * v_p + 4 * v_c + 9 * v_f;
  end if;
  if v_k <= 0 then
    raise exception 'meal_item: Kalorien oder Makros fehlen bei "%"', v_name using errcode = '22023';
  end if;

  return jsonb_build_object(
    'name',    v_name,
    'kcal',    round(v_k),
    'protein', trim_scale(round(v_p, 1)),
    'carbs',   trim_scale(round(v_c, 1)),
    'fat',     trim_scale(round(v_f, 1))
  );
end;
$$;

revoke all on function private.meal_item(jsonb, boolean) from public, anon;
grant execute on function private.meal_item(jsonb, boolean) to authenticated;

create function public.log_meal(p_meal jsonb, p_day date default null)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_today date := (now() at time zone 'Europe/Berlin')::date;
  v_day   text;
  v_name  text;
  v_ing   jsonb;
  v_sum   jsonb;
  v_meal  jsonb;
  v_at    text := to_char(clock_timestamp() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
  r       public.docs;
begin
  if jsonb_typeof(p_meal) is distinct from 'object' then
    raise exception 'log_meal: die Mahlzeit muss ein JSON-Objekt sein' using errcode = '22023';
  end if;
  v_name := btrim(coalesce(p_meal->>'name', ''));
  if v_name = '' then
    raise exception 'log_meal: Name der Mahlzeit fehlt' using errcode = '22023';
  end if;
  if p_day is not null and (p_day < v_today - 366 or p_day > v_today + 14) then
    raise exception 'log_meal: Datum % liegt ausserhalb des erlaubten Bereichs', p_day using errcode = '22023';
  end if;
  v_day := to_char(coalesce(p_day, v_today), 'YYYY-MM-DD');

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

    v_meal := jsonb_build_object('id', 'm' || substr(md5(random()::text || clock_timestamp()::text), 1, 10), 'name', v_name)
              || v_sum
              || jsonb_build_object('ingredients', v_ing, 'at', v_at);
  else
    v_meal := jsonb_build_object('id', 'm' || substr(md5(random()::text || clock_timestamp()::text), 1, 10))
              || private.meal_item(p_meal, true)
              || jsonb_build_object('at', v_at);
  end if;

  insert into public.docs as d (collection, id, data)
  values ('days', v_day, jsonb_build_object('date', v_day, 'meals', jsonb_build_array(v_meal)))
  on conflict (collection, id) do update
    set data = jsonb_set(
          d.data, '{meals}',
          (case when jsonb_typeof(d.data->'meals') = 'array' then d.data->'meals' else '[]'::jsonb end)
          || jsonb_build_array(v_meal))
  returning * into r;

  return jsonb_build_object(
    'tag', v_day,
    'eintrag', v_meal,
    'eintraege_am_tag', jsonb_array_length(r.data->'meals'),
    'tagessumme', (
      select jsonb_build_object(
               'kcal',    coalesce(round(sum((m->>'kcal')::numeric)), 0),
               'protein', coalesce(trim_scale(round(sum((m->>'protein')::numeric), 1)), 0),
               'carbs',   coalesce(trim_scale(round(sum((m->>'carbs')::numeric), 1)), 0),
               'fat',     coalesce(trim_scale(round(sum((m->>'fat')::numeric), 1)), 0))
        from jsonb_array_elements(r.data->'meals') as m),
    'tagesziel', r.data->'targets'
  );
end;
$$;

revoke all on function public.log_meal(jsonb, date) from public, anon;
grant execute on function public.log_meal(jsonb, date) to authenticated;
