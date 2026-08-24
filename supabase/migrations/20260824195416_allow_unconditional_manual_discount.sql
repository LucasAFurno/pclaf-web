create or replace function public.aplicar_descuento_en_presupuesto()
returns trigger language plpgsql set search_path = public, pg_temp as $$
declare
  cliente record;
  importe_base numeric;
  origen text;
  usa_beneficio boolean;
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

  if not found then return new; end if;

  usa_beneficio := coalesce(cliente.descuento_resena, false)
    and (new.created_at >= cliente.descuento_disponible_desde or coalesce(new.descuento_aplicado_manual, false));

  if not usa_beneficio and not coalesce(new.descuento_aplicado_manual, false) then
    return new;
  end if;

  origen := case when usa_beneficio then coalesce(cliente.descuento_origen, 'resena') else 'manual' end;
  new.presupuesto_original := public.formatear_importe_ars(importe_base);
  new.descuento_porcentaje := 10;
  new.descuento_origen := origen;
  new.descuento_aplicado_en := coalesce(new.descuento_aplicado_en, now());
  new.presupuesto := public.formatear_importe_ars(importe_base * .90);

  if usa_beneficio then
    update public.clientes
    set descuento_resena = false,
        descuento_origen = null,
        descuento_resena_usado = case when origen = 'resena' then true else descuento_resena_usado end
    where id = cliente.id;
  end if;
  return new;
end;
$$;
