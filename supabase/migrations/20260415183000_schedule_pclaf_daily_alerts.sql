create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'pclaf_daily_alerts') then
    perform cron.unschedule('pclaf_daily_alerts');
  end if;
end $$;

select cron.schedule(
  'pclaf_daily_alerts',
  '0 12 * * *',
  $$
  select net.http_post(
    url := 'https://bcmfzgjpqfjnudhgraan.supabase.co/functions/v1/pclaf-alerts',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-pclaf-alert-secret', 'pclaf_alerts_20260415'
    ),
    body := '{}'::jsonb
  );
  $$
);
