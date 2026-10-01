-- =====================================================================
-- VANTS — Notificaciones a Discord por cada evento de la plataforma
--
-- Flujo: cambio en una tabla → fila en public.vant_sync_events (outbox) →
--        pg_net llama a la Edge Function discord-notify → mensaje en el canal
--        de Discord que corresponda (anuncios, registros, ranked, staff, logs).
-- Un cron reintenta cada 5 minutos lo que no se pudo entregar.
-- Todo es aditivo: no se modifica ni se borra ningún dato existente.
-- =====================================================================

-- 1) Estado de entrega en el outbox existente
alter table public.vant_sync_events
  add column if not exists discord_status text,
  add column if not exists discord_attempts integer not null default 0,
  add column if not exists discord_error text;

-- Los eventos anteriores a esta migración no se publican (evita una avalancha de mensajes antiguos)
update public.vant_sync_events set discord_status = 'historico', discord_attempts = 5 where discord_status is null;

create index if not exists vant_sync_events_discord_pending_idx
  on public.vant_sync_events (created_at)
  where processed = false;


-- 1b) Canales de Discord por categoría (configurables con /vants canal desde Discord)
create table if not exists public.discord_channels (
  category text primary key check (category in ('anuncios', 'registros', 'ranked', 'staff', 'logs')),
  channel_id text not null check (channel_id ~ '^[0-9]{17,20}$'),
  guild_id text check (guild_id is null or guild_id ~ '^[0-9]{17,20}$'),
  updated_by text,
  updated_at timestamptz not null default now()
);
alter table public.discord_channels enable row level security;
-- Sin políticas: solo service_role (Edge Functions) lee y escribe.

-- 2) Secreto compartido entre la base de datos y la Edge Function (en Vault, nunca en el código)
do $$
begin
  if not exists (select 1 from vault.secrets where name = 'discord_notify_secret') then
    perform vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'discord_notify_secret', 'Firma pg_net → discord-notify');
  end if;
end $$;

create or replace function public.get_discord_notify_secret()
returns text
language sql
security definer
set search_path = ''
as $$
  select decrypted_secret from vault.decrypted_secrets where name = 'discord_notify_secret' limit 1;
$$;
revoke all on function public.get_discord_notify_secret() from public, anon, authenticated;
grant execute on function public.get_discord_notify_secret() to service_role;

-- 3) Emisor genérico hacia el outbox
create or replace function public.vants_emit(p_type text, p_entity text, p_id text, p_payload jsonb)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.vant_sync_events (event_type, source, entity_type, entity_id, payload)
  values (p_type, 'db', p_entity, p_id, coalesce(p_payload, '{}'::jsonb));
$$;
revoke all on function public.vants_emit(text, text, text, jsonb) from public, anon, authenticated;

-- 4) Disparadores por tabla
create or replace function public.trg_vants_notify_tournament()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    if new.status is distinct from 'draft' then
      perform public.vants_emit('torneo_publicado', 'tournament', new.id::text, jsonb_build_object(
        'name', new.name, 'slug', new.slug, 'status', new.status, 'format', new.format, 'tier', new.tier,
        'prize_pool', new.prize_pool, 'max', new.max_participants, 'starts_at', new.starts_at, 'registration_closes_at', new.registration_closes_at));
    end if;
  elsif new.status is distinct from old.status then
    perform public.vants_emit(case when old.status = 'draft' then 'torneo_publicado' else 'torneo_estado' end, 'tournament', new.id::text, jsonb_build_object(
      'name', new.name, 'slug', new.slug, 'status', new.status, 'old_status', old.status, 'format', new.format, 'tier', new.tier,
      'prize_pool', new.prize_pool, 'max', new.max_participants, 'current', new.current_participants, 'starts_at', new.starts_at));
  end if;
  return new;
end $$;

create or replace function public.trg_vants_notify_event()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    perform public.vants_emit('evento_publicado', 'event', new.id::text, jsonb_build_object(
      'title', new.title, 'type', new.event_type, 'status', new.status, 'location', new.location,
      'starts_at', new.starts_at, 'ends_at', new.ends_at, 'max', new.max_attendees, 'image_url', new.image_url));
  elsif new.status is distinct from old.status then
    perform public.vants_emit('evento_estado', 'event', new.id::text, jsonb_build_object(
      'title', new.title, 'status', new.status, 'old_status', old.status, 'starts_at', new.starts_at));
  end if;
  return new;
end $$;

create or replace function public.trg_vants_notify_entry()
returns trigger language plpgsql security definer set search_path = '' as $$
declare t record; p record;
begin
  select name, slug, current_participants, max_participants into t from public.tournaments where id = new.tournament_id;
  select username, display_name into p from public.players where id = new.player_id;
  perform public.vants_emit('torneo_inscripcion', 'tournament_entry', new.id::text, jsonb_build_object(
    'tournament', t.name, 'slug', t.slug, 'current', t.current_participants, 'max', t.max_participants,
    'player', coalesce(p.display_name, p.username), 'username', p.username));
  return new;
end $$;

create or replace function public.trg_vants_notify_rsvp()
returns trigger language plpgsql security definer set search_path = '' as $$
declare e record; p record;
begin
  select title, starts_at into e from public.events where id = new.event_id;
  select username, display_name into p from public.players where id = new.player_id;
  perform public.vants_emit('evento_asistencia', 'event_rsvp', new.id::text, jsonb_build_object(
    'event', e.title, 'starts_at', e.starts_at, 'status', new.status, 'player', coalesce(p.display_name, p.username), 'username', p.username));
  return new;
end $$;

create or replace function public.trg_vants_notify_entitlement()
returns trigger language plpgsql security definer set search_path = '' as $$
declare p record;
begin
  if new.is_active then
    select username, display_name into p from public.players where id = new.player_id;
    perform public.vants_emit('plan_activado', 'entitlement', new.id::text, jsonb_build_object(
      'tier', new.tier, 'source', new.source, 'player', coalesce(p.display_name, p.username), 'username', p.username, 'expires_at', new.expires_at));
  end if;
  return new;
end $$;

create or replace function public.trg_vants_notify_ticket()
returns trigger language plpgsql security definer set search_path = '' as $$
declare p record;
begin
  select username, display_name into p from public.players where id = new.player_id;
  perform public.vants_emit('ticket_creado', 'support_ticket', new.id::text, jsonb_build_object(
    'subject', new.subject, 'category', new.category, 'priority', new.priority,
    'player', coalesce(p.display_name, p.username), 'username', p.username, 'discord_id', new.discord_id));
  return new;
end $$;

create or replace function public.trg_vants_notify_postulacion()
returns trigger language plpgsql security definer set search_path = '' as $$
declare p record;
begin
  select username, display_name into p from public.players where id = new.player_id;
  if tg_op = 'INSERT' then
    perform public.vants_emit('postulacion_creada', 'postulacion', new.id::text, jsonb_build_object(
      'player', coalesce(p.display_name, p.username), 'username', p.username, 'discord_id', new.discord_id));
  elsif new.status is distinct from old.status then
    perform public.vants_emit('postulacion_estado', 'postulacion', new.id::text, jsonb_build_object(
      'player', coalesce(p.display_name, p.username), 'username', p.username, 'status', new.status, 'reviewed_by', new.reviewed_by));
  end if;
  return new;
end $$;

create or replace function public.trg_vants_notify_season()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' or new.status is distinct from old.status then
    perform public.vants_emit('temporada_' || new.status, 'season', new.id::text, jsonb_build_object(
      'name', new.name, 'number', new.season_number, 'status', new.status, 'start_date', new.start_date, 'end_date', new.end_date));
  end if;
  return new;
end $$;

create or replace function public.trg_vants_notify_ranked_match()
returns trigger language plpgsql security definer set search_path = '' as $$
declare a record; b record;
begin
  if new.status = 'completed' and old.status is distinct from 'completed' then
    select username, display_name into a from public.players where id = new.player1_id;
    select username, display_name into b from public.players where id = new.player2_id;
    perform public.vants_emit('ranked_resultado', 'ranked_match', new.id::text, jsonb_build_object(
      'p1', coalesce(a.display_name, a.username), 'p2', coalesce(b.display_name, b.username),
      'result', new.result, 'mmr_p1', new.mmr_change_p1, 'mmr_p2', new.mmr_change_p2));
  end if;
  return new;
end $$;

create or replace function public.trg_vants_notify_tournament_match()
returns trigger language plpgsql security definer set search_path = '' as $$
declare t record; a record; b record; w record;
begin
  if new.status = 'completed' and old.status is distinct from 'completed' then
    select name, slug into t from public.tournaments where id = new.tournament_id;
    select username, display_name into a from public.players where id = new.player1_id;
    select username, display_name into b from public.players where id = new.player2_id;
    select username, display_name into w from public.players where id = new.winner_id;
    perform public.vants_emit('torneo_resultado', 'tournament_match', new.id::text, jsonb_build_object(
      'tournament', t.name, 'slug', t.slug, 'round', new.round,
      'p1', coalesce(a.display_name, a.username), 'p2', coalesce(b.display_name, b.username),
      's1', new.player1_score, 's2', new.player2_score, 'winner', coalesce(w.display_name, w.username)));
  end if;
  return new;
end $$;

drop trigger if exists vants_notify_tournament on public.tournaments;
create trigger vants_notify_tournament after insert or update of status on public.tournaments
  for each row execute function public.trg_vants_notify_tournament();
drop trigger if exists vants_notify_event on public.events;
create trigger vants_notify_event after insert or update of status on public.events
  for each row execute function public.trg_vants_notify_event();
drop trigger if exists vants_notify_entry on public.tournament_entries;
create trigger vants_notify_entry after insert on public.tournament_entries
  for each row execute function public.trg_vants_notify_entry();
drop trigger if exists vants_notify_rsvp on public.event_rsvps;
create trigger vants_notify_rsvp after insert on public.event_rsvps
  for each row execute function public.trg_vants_notify_rsvp();
drop trigger if exists vants_notify_entitlement on public.entitlements;
create trigger vants_notify_entitlement after insert on public.entitlements
  for each row execute function public.trg_vants_notify_entitlement();
drop trigger if exists vants_notify_ticket on public.support_tickets;
create trigger vants_notify_ticket after insert on public.support_tickets
  for each row execute function public.trg_vants_notify_ticket();
drop trigger if exists vants_notify_postulacion on public.postulaciones;
create trigger vants_notify_postulacion after insert or update of status on public.postulaciones
  for each row execute function public.trg_vants_notify_postulacion();
drop trigger if exists vants_notify_season on public.seasons;
create trigger vants_notify_season after insert or update of status on public.seasons
  for each row execute function public.trg_vants_notify_season();
drop trigger if exists vants_notify_ranked_match on public.ranked_matches;
create trigger vants_notify_ranked_match after update of status on public.ranked_matches
  for each row execute function public.trg_vants_notify_ranked_match();
drop trigger if exists vants_notify_tournament_match on public.tournament_matches;
create trigger vants_notify_tournament_match after update of status on public.tournament_matches
  for each row execute function public.trg_vants_notify_tournament_match();

-- 5) Entrega inmediata: cada fila nueva del outbox avisa a la Edge Function (asíncrono vía pg_net)
create or replace function public.trg_vants_dispatch_discord()
returns trigger language plpgsql security definer set search_path = '' as $$
declare secret text;
begin
  select decrypted_secret into secret from vault.decrypted_secrets where name = 'discord_notify_secret' limit 1;
  if secret is null then return new; end if;
  perform net.http_post(
    url := 'https://qtetsgwwsvqzquxssudj.supabase.co/functions/v1/discord-notify',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-vants-notify', secret),
    body := jsonb_build_object('id', new.id),
    timeout_milliseconds := 8000
  );
  return new;
exception when others then
  -- Nunca bloquear la escritura original por un fallo de notificación; el cron reintenta.
  return new;
end $$;

drop trigger if exists vants_dispatch_discord on public.vant_sync_events;
create trigger vants_dispatch_discord after insert on public.vant_sync_events
  for each row execute function public.trg_vants_dispatch_discord();

-- 6) Reintentos cada 5 minutos
create or replace function public.vants_retry_discord()
returns void language plpgsql security definer set search_path = '' as $$
declare secret text;
begin
  select decrypted_secret into secret from vault.decrypted_secrets where name = 'discord_notify_secret' limit 1;
  if secret is null then return; end if;
  if exists (select 1 from public.vant_sync_events where processed = false and discord_attempts < 5 and created_at < now() - interval '1 minute' and created_at > now() - interval '2 days') then
    perform net.http_post(
      url := 'https://qtetsgwwsvqzquxssudj.supabase.co/functions/v1/discord-notify',
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-vants-notify', secret),
      body := jsonb_build_object('retry', true),
      timeout_milliseconds := 15000
    );
  end if;
end $$;
revoke all on function public.vants_retry_discord() from public, anon, authenticated;

select cron.unschedule(jobid) from cron.job where jobname = 'vants-discord-retry';
select cron.schedule('vants-discord-retry', '*/5 * * * *', 'select public.vants_retry_discord()');

-- Revocar ejecución pública de las funciones de trigger (solo las usa la base de datos)
revoke all on function public.trg_vants_notify_tournament() from public, anon, authenticated;
revoke all on function public.trg_vants_notify_event() from public, anon, authenticated;
revoke all on function public.trg_vants_notify_entry() from public, anon, authenticated;
revoke all on function public.trg_vants_notify_rsvp() from public, anon, authenticated;
revoke all on function public.trg_vants_notify_entitlement() from public, anon, authenticated;
revoke all on function public.trg_vants_notify_ticket() from public, anon, authenticated;
revoke all on function public.trg_vants_notify_postulacion() from public, anon, authenticated;
revoke all on function public.trg_vants_notify_season() from public, anon, authenticated;
revoke all on function public.trg_vants_notify_ranked_match() from public, anon, authenticated;
revoke all on function public.trg_vants_notify_tournament_match() from public, anon, authenticated;
revoke all on function public.trg_vants_dispatch_discord() from public, anon, authenticated;
