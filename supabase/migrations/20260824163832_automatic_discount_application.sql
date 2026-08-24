-- El presupuesto que se carga es el valor de lista. El valor visible/cobrable
-- queda en reparaciones.presupuesto y el original se conserva para auditoría.
alter table public.reparaciones
  add column if not exists presupuesto_original text,
  add column if not exists descuento_porcentaje numeric(5,2),
  add column if not exists descuento_origen text,
  add column if not exists descuento_aplicado_en timestamptz;

alter table public.reparaciones
  drop constraint if exists reparaciones_descuento_origen_check;

alter table public.reparaciones
  add constraint reparaciones_descuento_origen_check
  check (descuento_origen is null or descuento_origen in ('resena', 'referido'));

create or replace function public.formatear_importe_ars(importe numeric)
returns text language sql immutable as $$
  select '$' || replace(to_char(round(importe), 'FM999,999,999,990'), ',', '.');
$$;

create or replace function public.aplicar_descuento_en_presupuesto()
returns trigger language plpgsql set search_path = public, pg_temp as $$
declare
  cliente record;
  importe_base numeric;
  origen text;
begin
  if coalesce(btrim(new.presupuesto), '') = '' then return new; end if;
  importe_base := nullif(regexp_replace(new.presupuesto, '[^0-9]', '', 'g'), '')::numeric;
  if importe_base is null then return new; end if;

  -- Recalcula un descuento ya aplicado sin consumirlo por segunda vez.
  if coalesce(new.descuento_porcentaje, 0) > 0 then
    new.presupuesto_original := public.formatear_importe_ars(importe_base);
    new.presupuesto := public.formatear_importe_ars(importe_base * (1 - new.descuento_porcentaje / 100));
    return new;
  end if;

  select c.id, c.descuento_resena, c.descuento_origen into cliente
  from public.equipos e join public.clientes c on c.id = e.cliente_id
  where e.id = new.equipo_id for update of c;
  if not found or not coalesce(cliente.descuento_resena, false) then return new; end if;

  origen := coalesce(cliente.descuento_origen, 'resena');
  new.presupuesto_original := public.formatear_importe_ars(importe_base);
  new.descuento_porcentaje := 10;
  new.descuento_origen := origen;
  new.descuento_aplicado_en := coalesce(new.descuento_aplicado_en, now());
  new.presupuesto := public.formatear_importe_ars(importe_base * .90);

  update public.clientes
  set descuento_resena = false,
      descuento_origen = null,
      descuento_resena_usado = case when origen = 'resena' then true else descuento_resena_usado end
  where id = cliente.id;
  return new;
end;
$$;

drop trigger if exists aplicar_descuento_en_presupuesto on public.reparaciones;
create trigger aplicar_descuento_en_presupuesto
before insert or update of presupuesto on public.reparaciones
for each row execute function public.aplicar_descuento_en_presupuesto();
