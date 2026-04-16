# pclaf-alerts

Alertas automaticas internas de PCLAF.

Actualmente envia un resumen diario por Telegram con:

- turnos de hoy
- reparaciones en espera, proceso y listo
- urgentes activos
- activas sin presupuesto
- listas hace mas de 3 dias
- en espera hace mas de 7 dias
- clientes con descuento activo

Se invoca desde Supabase Cron.
