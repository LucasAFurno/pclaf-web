-- Un descuento obtenido al finalizar una reparación sólo puede usarse en un
-- equipo ingresado después de que el beneficio fue acreditado.
alter table public.clientes
  add column if not exists descuento_disponible_desde timestamptz;

-- Los beneficios que ya estaban activos pasan a valer desde esta migración;
-- así nunca se descuentan reparaciones históricas, como la que generó la reseña.
update public.clientes
set descuento_disponible_desde = now()
where descuento_resena = true
  and descuento_disponible_desde is null;

create or replace function public.marcar_inicio_descuento_cliente()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  if coalesce(new.descuento_resena, false)
     and not coalesce(old.descuento_resena, false) then
    new.descuento_disponible_desde := now();
  elsif not coalesce(new.descuento_resena, false) then
    new.descuento_disponible_desde := null;
  end if;
  return new;
end;
$$;

drop trigger if exists marcar_inicio_descuento_cliente on public.clientes;
create trigger marcar_inicio_descuento_cliente
before update of descuento_resena on public.clientes
for each row execute function public.marcar_inicio_descuento_cliente();

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

  if coalesce(new.descuento_porcentaje, 0) > 0 then
    new.presupuesto_original := public.formatear_importe_ars(importe_base);
    new.presupuesto := public.formatear_importe_ars(importe_base * (1 - new.descuento_porcentaje / 100));
    return new;
  end if;

  select c.id, c.descuento_resena, c.descuento_origen, c.descuento_disponible_desde
  into cliente
  from public.equipos e join public.clientes c on c.id = e.cliente_id
  where e.id = new.equipo_id for update of c;

  if not found
     or not coalesce(cliente.descuento_resena, false)
     or new.created_at < cliente.descuento_disponible_desde then
    return new;
  end if;

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
