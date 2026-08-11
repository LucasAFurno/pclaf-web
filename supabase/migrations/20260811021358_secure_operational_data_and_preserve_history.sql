-- Los accesos públicos pasan por la Edge Function pclaf-portal, que devuelve
-- únicamente los datos mínimos para el historial y para pedir turnos.
begin;

do $$
declare
  table_name text;
  policy_name text;
begin
  foreach table_name in array array['calificaciones','clientes','equipos','fotos','pasos','reparaciones','reportes','turnos']
  loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('revoke all privileges on table public.%I from anon', table_name);
    execute format('grant select, insert, update, delete on table public.%I to authenticated', table_name);
    for policy_name in
      select policyname from pg_policies where schemaname = 'public' and tablename = table_name
    loop
      execute format('drop policy if exists %I on public.%I', policy_name, table_name);
    end loop;
    execute format(
      'create policy %I on public.%I for all to authenticated using ((select lower(auth.jwt() ->> ''email'')) = ''lucas_yenkoz28@hotmail.com'') with check ((select lower(auth.jwt() ->> ''email'')) = ''lucas_yenkoz28@hotmail.com'')',
      'PCLAF administrator manages ' || table_name, table_name
    );
  end loop;
end $$;

-- La eliminación automática diaria de fotografías es irreversible. Se conserva
-- el historial y se desactiva el job; cualquier futura retención debe archivar
-- y respaldar antes de borrar.
select cron.unschedule(jobid)
from cron.job
where jobname = 'borrar-fotos-viejas';

alter function public.borrar_fotos_viejas() set search_path = public, pg_temp;

commit;
