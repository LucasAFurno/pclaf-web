-- Protege los datos comerciales del módulo Web.
-- El panel debe iniciar sesión con Supabase Auth usando la cuenta administradora
-- indicada abajo. La clave publishable puede seguir estando en el navegador: RLS
-- rechaza cualquier solicitud que no lleve el JWT de esa cuenta.
begin;

alter table public.web_proyectos enable row level security;

revoke all privileges on table public.web_proyectos from anon;
revoke all privileges on sequence public.web_proyectos_id_seq from anon;

grant select, insert, update, delete on table public.web_proyectos to authenticated;
grant usage, select on sequence public.web_proyectos_id_seq to authenticated;

drop policy if exists "legacy admin can manage web projects" on public.web_proyectos;
drop policy if exists "PCLAF administrator manages web projects" on public.web_proyectos;

create policy "PCLAF administrator manages web projects"
on public.web_proyectos
for all
to authenticated
using (
  (select lower(auth.jwt() ->> 'email')) = 'lucas_yenkoz28@hotmail.com'
)
with check (
  (select lower(auth.jwt() ->> 'email')) = 'lucas_yenkoz28@hotmail.com'
);

commit;
