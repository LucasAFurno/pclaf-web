alter table public.reparaciones
drop constraint if exists reparaciones_estado_check;

alter table public.reparaciones
add constraint reparaciones_estado_check
check (
  estado = any (
    array[
      'espera'::text,
      'proceso'::text,
      'listo'::text,
      'entregado'::text,
      'cancelado'::text
    ]
  )
);
