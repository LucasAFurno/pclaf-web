-- Corrige falsos positivos del backfill inicial.
begin;

-- El ícono 🎮 también se usaba para PC Gamer: no lo tomamos como consola.
update public.equipos
set tipo_equipo = 'otro'
where tipo_equipo = 'otro'
  and icono = '🎮'
  and lower(concat_ws(' ', nombre, modelo)) !~ '(playstation|xbox|consola|(^|[^a-z])ps[345]([^0-9]|$))';

-- Samsung aparece en notebooks; solo conservar celular cuando hay señales
-- específicas y no hay vocabulario de PC/notebook.
update public.equipos
set tipo_equipo = 'otro'
where tipo_equipo = 'celular'
  and lower(concat_ws(' ', nombre, modelo)) ~ '(notebook|laptop|pc|computadora|windows|gpu|pasta|office|book)';

update public.equipos
set tipo_equipo = 'celular'
where tipo_equipo = 'otro'
  and lower(concat_ws(' ', nombre, modelo)) ~ '(celular|telefono|teléfono|iphone|ipad|android|galaxy|redmi|moto[[:space:]]*[gedge]?|huawei|oppo|realme|oneplus|alcatel|nokia)'
  and lower(concat_ws(' ', nombre, modelo)) !~ '(notebook|laptop|pc|computadora|windows|gpu|pasta|office|book)';

commit;
