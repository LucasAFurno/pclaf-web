-- Keep the existing daily schedule while moving its authentication secret to Vault.
create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

select cron.unschedule('pclaf_daily_alerts');

select cron.schedule(
  'pclaf_daily_alerts',
  '0 12 * * *',
  $$
  select net.http_post(
    url := 'https://bcmfzgjpqfjnudhgraan.supabase.co/functions/v1/pclaf-alerts',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-pclaf-alert-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'pclaf_alert_secret')
    ),
    body := '{}'::jsonb
  );
  $$
);
