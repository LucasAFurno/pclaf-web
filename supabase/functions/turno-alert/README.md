# turno-alert

Funcion de Supabase Edge para avisar nuevos turnos.

## Que hace

- Envia un mensaje a Telegram cuando entra un turno nuevo.
- Puede mandar mail como respaldo si Telegram falla.
- Si queres, tambien puede mandar mail siempre.

## Variables requeridas

- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_CHAT_ID`

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
supabase functions deploy turno-alert
supabase secrets set TELEGRAM_BOT_TOKEN=... TELEGRAM_CHAT_ID=...
supabase secrets set RESEND_API_KEY=... TURNO_ALERT_EMAIL_TO=... TURNO_ALERT_EMAIL_FROM=...
supabase secrets set TURNO_ALERT_EMAIL_MODE=fallback
```

## Importante

La web ya lo invoca al crear el turno desde `turnos.html`.

Si mas adelante queres maxima confiabilidad, el siguiente paso ideal es mover el disparo a un webhook/trigger de base de datos en Supabase para que la alerta salga incluso si el navegador del cliente corta la request justo despues del alta.
