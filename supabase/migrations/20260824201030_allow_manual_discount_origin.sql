alter table public.reparaciones
  drop constraint if exists reparaciones_descuento_origen_check;

alter table public.reparaciones
  add constraint reparaciones_descuento_origen_check
  check (descuento_origen is null or descuento_origen in ('resena', 'referido', 'manual'));
