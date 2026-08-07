# turno-alert

Funcion de Supabase Edge para avisar nuevos turnos.

## Que hace

- Envia Telegram, Discord y mail de respaldo cuando entra un turno nuevo.
- Puede mandar mail como respaldo si Telegram falla.
- Si queres, tambien puede mandar mail siempre.

## Variables requeridas

- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_CHAT_ID`
- `PCLAF_WEB_TURNO_ALERT_TRIGGER_SECRET`
- `PCLAF_WEB_DISCORD_ENABLED`
- `PCLAF_WEB_DISCORD_TURNOS_WEBHOOK_URL`

## Variables opcionales para mail

- `RESEND_API_KEY`
- `TURNO_ALERT_EMAIL_TO`
- `TURNO_ALERT_EMAIL_FROM`
- `TURNO_ALERT_EMAIL_MODE`

`TURNO_ALERT_EMAIL_MODE` acepta:

- `fallback` (default): manda mail solo si Telegram falla.
- `always`: manda mail siempre, ademas de Telegram.

## Deploy

```bash
supabase functions deploy turno-alert --no-verify-jwt
supabase secrets set TELEGRAM_BOT_TOKEN=... TELEGRAM_CHAT_ID=... PCLAF_WEB_TURNO_ALERT_TRIGGER_SECRET=...
supabase secrets set PCLAF_WEB_DISCORD_ENABLED=true PCLAF_WEB_DISCORD_TURNOS_WEBHOOK_URL=...
supabase secrets set RESEND_API_KEY=... TURNO_ALERT_EMAIL_TO=... TURNO_ALERT_EMAIL_FROM=...
supabase secrets set TURNO_ALERT_EMAIL_MODE=fallback
```

## Importante

La alerta se dispara desde un trigger PostgreSQL después del INSERT en `turnos`; `turnos.html` no llama a la función.
