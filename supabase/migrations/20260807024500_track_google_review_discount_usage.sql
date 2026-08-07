-- A Google review earns one discount per client. Keep its consumption separate
-- from whether a discount is currently pending for the next repair.
alter table public.clientes
  add column if not exists descuento_resena_usado boolean not null default false,
  add column if not exists descuento_origen text;

alter table public.clientes
  drop constraint if exists clientes_descuento_origen_check;

alter table public.clientes
  add constraint clientes_descuento_origen_check
  check (descuento_origen is null or descuento_origen in ('resena', 'referido'));
