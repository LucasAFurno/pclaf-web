# pclaf-alerts

Alertas automaticas internas de PCLAF.

Actualmente envia el mismo resumen diario por Telegram y Discord con:

- turnos de hoy
- reparaciones en espera, proceso y listo
- urgentes activos
- activas sin presupuesto
- listas hace mas de 3 dias
- en espera hace mas de 7 dias
- clientes con descuento activo

Se invoca desde Supabase Cron.
