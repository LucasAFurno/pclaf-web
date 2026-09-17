-- Clasificación explícita y datos operativos para celulares.
-- Mantiene el flujo existente clientes -> equipos -> reparaciones.
begin;

alter table public.equipos
  add column if not exists tipo_equipo text not null default 'otro',
  add column if not exists marca text,
  add column if not exists imei text,
  add column if not exists accesorios text,
  add column if not exists estado_fisico text,
  add column if not exists clave_dispositivo text;

alter table public.equipos
  drop constraint if exists equipos_tipo_equipo_check;

alter table public.equipos
  add constraint equipos_tipo_equipo_check
  check (tipo_equipo in ('pc','consola','celular','otro'));

create index if not exists equipos_tipo_equipo_idx
  on public.equipos (tipo_equipo);

-- Backfill conservador para los registros existentes.
update public.equipos
set tipo_equipo = 'consola'
where tipo_equipo = 'otro'
  and lower(concat_ws(' ', nombre, modelo)) ~ '(playstation|xbox|consola|(^|[^a-z])ps[345]([^0-9]|$))';

update public.equipos
set tipo_equipo = 'celular'
where tipo_equipo = 'otro'
  and lower(concat_ws(' ', nombre, modelo)) ~ '(celular|telefono|teléfono|iphone|ipad|samsung|motorola|xiaomi|redmi|huawei|oppo|realme|oneplus|alcatel|nokia)';

commit;
