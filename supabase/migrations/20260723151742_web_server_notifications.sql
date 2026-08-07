-- Server-side notifications for PCLAF Web. The secrets below live in Vault,
-- while Discord and Telegram secrets remain Edge Function secrets.
create extension if not exists pg_net with schema extensions;
create schema if not exists private;

create or replace function private.dispatch_pclaf_web_notification()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, extensions, vault
as $$
declare
  v_url text;
  v_secret text;
begin
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'pclaf_web_turno_alert_url';
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'pclaf_web_turno_alert_trigger_secret';
  if coalesce(v_url, '') = '' or coalesce(v_secret, '') = '' then
    return coalesce(new, old);
  end if;
  perform net.http_post(
    url := v_url,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-pclaf-turno-alert-secret', v_secret),
    body := jsonb_build_object('type', TG_OP, 'table', TG_TABLE_NAME, 'record', to_jsonb(new), 'old_record', to_jsonb(old)),
    timeout_milliseconds := 8000
  );
  return coalesce(new, old);
end;
$$;

revoke all on function private.dispatch_pclaf_web_notification() from public, anon, authenticated;

drop trigger if exists pclaf_web_turno_alert_after_insert on public.turnos;
create trigger pclaf_web_turno_alert_after_insert
after insert on public.turnos
for each row execute function private.dispatch_pclaf_web_notification();

drop trigger if exists pclaf_web_client_notifications on public.clientes;
create trigger pclaf_web_client_notifications
after insert or update of descuento_resena on public.clientes
for each row execute function private.dispatch_pclaf_web_notification();

drop trigger if exists pclaf_web_repair_notifications on public.reparaciones;
create trigger pclaf_web_repair_notifications
after insert or update of estado on public.reparaciones
for each row execute function private.dispatch_pclaf_web_notification();
