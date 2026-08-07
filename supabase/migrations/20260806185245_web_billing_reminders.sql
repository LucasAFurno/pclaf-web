-- Renewal dates are kept independently from delivery dates. `proxima_renovacion`
-- already represents the domain renewal and is shown as due 30 days in advance.
alter table public.web_proyectos
  add column if not exists monto_mensual_usd numeric(12,2),
  add column if not exists proximo_cobro date;

create index if not exists web_proyectos_renovacion_idx
  on public.web_proyectos (proxima_renovacion)
  where proxima_renovacion is not null;

create index if not exists web_proyectos_proximo_cobro_idx
  on public.web_proyectos (proximo_cobro)
  where proximo_cobro is not null;
