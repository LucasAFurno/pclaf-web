-- Genera códigos de cliente como NOMBREAP01 y evita colisiones concurrentes.
create unique index if not exists clientes_codigo_unique_idx
  on public.clientes (codigo)
  where codigo is not null and btrim(codigo) <> '';

create or replace function public.set_cliente_codigo()
returns trigger
language plpgsql
as $$
declare
  nombre_limpio text;
  apellido_limpio text;
  prefijo text;
  candidato text;
  numero integer := 1;
begin
  if new.codigo is not null and btrim(new.codigo) <> '' then
    return new;
  end if;

  nombre_limpio := regexp_replace(translate(upper(coalesce(new.nombre, '')), 'ÁÉÍÓÚÜÑ', 'AEIOUUN'), '[^A-Z0-9]', '', 'g');
  apellido_limpio := regexp_replace(translate(upper(coalesce(new.apellido, '')), 'ÁÉÍÓÚÜÑ', 'AEIOUUN'), '[^A-Z0-9]', '', 'g');
  prefijo := left(nombre_limpio, 2) || left(apellido_limpio, 2);
  prefijo := rpad(left(prefijo, 4), 4, 'X');

  -- Serializa altas del mismo prefijo para que dos altas simultáneas no reciban el mismo código.
  perform pg_advisory_xact_lock(hashtext(prefijo));
  loop
    candidato := prefijo || lpad(numero::text, 2, '0');
    exit when not exists (
      select 1 from public.clientes where codigo = candidato
    );
    numero := numero + 1;
  end loop;

  new.codigo := candidato;
  return new;
end;
$$;

drop trigger if exists set_cliente_codigo on public.clientes;
create trigger set_cliente_codigo
before insert on public.clientes
for each row execute function public.set_cliente_codigo();
