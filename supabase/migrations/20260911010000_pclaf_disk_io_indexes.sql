-- Additive indexes to cut Disk IO on free-tier PostgREST reads.
-- No data changes. Safe to re-run (IF NOT EXISTS).

CREATE INDEX IF NOT EXISTS reparaciones_equipo_id_idx
  ON public.reparaciones (equipo_id);

CREATE INDEX IF NOT EXISTS reparaciones_estado_numero_idx
  ON public.reparaciones (estado, numero DESC);

CREATE INDEX IF NOT EXISTS pasos_reparacion_id_idx
  ON public.pasos (reparacion_id);

CREATE INDEX IF NOT EXISTS turnos_fecha_idx
  ON public.turnos (fecha);

CREATE INDEX IF NOT EXISTS turnos_estado_created_at_idx
  ON public.turnos (estado, created_at DESC);
