# pclaf-bot

Bot interno de Telegram para consultas rapidas del panel PCLAF.

Tambien interpreta consultas simples en lenguaje natural, por ejemplo:

- `mostrame las reparaciones listas`
- `proximo turno`
- `busca cliente tiesto`
- `pasar la 3288 a listo`
- `whatsapp 3288`

## Comandos

- `/resumen`
- `/hoy`
- `/manana`
- `/urgentes`
- `/espera`
- `/proceso`
- `/listo`
- `/canceladas`
- `/turno`
- `/turnos`
- `/descuentos`
- `/cliente texto`
- `/reparacion 3288`
- `/wa 3288`
- `/proceso 3288`
- `/listo 3288`
- `/cancelar 3288`
- `/nota 3288 texto`

## Secrets usados

- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_CHAT_ID`
- `TELEGRAM_WEBHOOK_SECRET`
- `SUPABASE_SERVICE_ROLE_KEY` o `SUPABASE_ANON_KEY`

`TELEGRAM_CHAT_ID` limita las respuestas al chat interno autorizado.
