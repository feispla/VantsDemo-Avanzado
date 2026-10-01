-- ============================================
-- VANTS — Login con Steam + Zona exclusiva por plan
-- Migración aditiva: no modifica ni borra objetos existentes.
-- ============================================

-- 1) State temporal de un solo uso para el login/vinculación con Steam (OpenID 2.0)
create table if not exists public.steam_login_state (
  state_id    uuid primary key default gen_random_uuid(),
  redirect_to text not null,
  user_id     uuid references auth.users (id) on delete cascade, -- solo en modo "vincular"
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null default now() + interval '10 minutes'
);
alter table public.steam_login_state enable row level security;
-- Sin policies: solo el service_role (Edge Function steam-login) puede leer/escribir.
create index if not exists steam_login_state_expires_idx on public.steam_login_state (expires_at);

-- 2) Rango del plan activo del usuario actual (0 free, 1 basic, 2 pro, 3 elite)
create or replace function public.current_plan_rank()
returns int
language sql
stable
security definer
set search_path to ''
as $$
  select coalesce(max(case lower(e.tier) when 'basic' then 1 when 'pro' then 2 when 'elite' then 3 else 0 end), 0)
  from public.entitlements e
  where e.player_id = public.current_player_id()
    and e.is_active
    and (e.expires_at is null or e.expires_at > now())
$$;
revoke all on function public.current_plan_rank() from public, anon;
grant execute on function public.current_plan_rank() to authenticated;

-- 3) Contenido exclusivo por plan. RLS: cada usuario solo lee su plan y los inferiores.
create table if not exists public.plan_content (
  id          uuid primary key default gen_random_uuid(),
  tier        text not null check (tier in ('basic', 'pro', 'elite')),
  kind        text not null default 'perk' check (kind in ('perk', 'link', 'announcement', 'code')),
  title       text not null check (length(title) between 2 and 120),
  body        text check (length(body) <= 2000),
  cta_label   text check (length(cta_label) <= 40),
  cta_url     text check (cta_url is null or cta_url ~ '^(https://|#/)'),
  sort_order  int not null default 100,
  published   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
alter table public.plan_content enable row level security;

create policy "plan_content: lectura según plan"
  on public.plan_content for select
  to authenticated
  using (
    published
    and (case tier when 'basic' then 1 when 'pro' then 2 when 'elite' then 3 end) <= (select public.current_plan_rank())
  );

create index if not exists plan_content_tier_idx on public.plan_content (tier, sort_order) where published;

-- Contenido inicial basado en las ventajas publicadas en /precios (editable desde Supabase)
insert into public.plan_content (tier, kind, title, body, cta_label, cta_url, sort_order) values
  ('basic', 'perk', 'Inscripción a VANT Open', 'Tu ticket BASIC te da acceso a los torneos abiertos de esta temporada. Inscríbete desde la página de cada torneo.', 'Ver torneos', '#/torneos', 10),
  ('basic', 'perk', 'Perfil Ranked (Bronze–Gold)', 'Tu perfil compite en el ranked VANTS. Completa las partidas de placement con el bot de Discord.', 'Ver ranked', '#/ranked', 20),
  ('basic', 'link', 'Soporte estándar', 'Abre un ticket desde tu cuenta y el equipo te responde por correo o Discord.', 'Abrir ticket', '#/cuenta', 30),
  ('pro', 'perk', 'VANT Pro Series', 'Acceso a la Pro Series. Los cupos y fechas se publican primero aquí y en Discord.', 'Ver torneos', '#/torneos', 10),
  ('pro', 'link', 'Sala privada y scrims', 'Pide acceso a la sala privada de scrims en el servidor de Discord indicando tu usuario VANTS.', 'Abrir Discord', 'https://discord.gg/rCHE7jvRS4', 20),
  ('pro', 'perk', 'Prioridad en tryouts', 'Tus postulaciones a tryouts se revisan antes que las del plan gratuito.', null, null, 30),
  ('pro', 'perk', 'Rol Operator', 'Rol Operator equivalente en Discord. Si no lo tienes, abre un ticket con tu usuario.', 'Abrir ticket', '#/cuenta', 40),
  ('elite', 'perk', 'VANT Elite Invitational', 'Plaza para el Elite Invitational. Te avisaremos por correo y Discord cuando abra la inscripción.', null, null, 10),
  ('elite', 'link', 'Canal Command', 'Canal privado Command en Discord con el staff de VANTS.', 'Abrir Discord', 'https://discord.gg/rCHE7jvRS4', 20),
  ('elite', 'perk', 'Badge Elite en tu perfil', 'Tu perfil público y el leaderboard muestran la insignia ELITE.', 'Ver mi cuenta', '#/cuenta', 30),
  ('elite', 'perk', 'Verificación prioritaria', 'Las revisiones de verificación de tu cuenta pasan primero en la cola del staff.', null, null, 40);
