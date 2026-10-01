// ============================================
// discord-notify — Publica en Discord cada evento de la plataforma VANTS
//
// La base de datos llama a esta función (pg_net) cada vez que entra una fila en
// public.vant_sync_events, con la cabecera x-vants-notify = secreto de Vault.
//
//  POST {id}            → entrega ese evento
//  POST {retry:true}    → reintenta los pendientes (cron cada 5 min)
//  GET  ?check=1        → diagnóstico: qué destinos están configurados (sin revelar valores)
//
// Destino por categoría (anuncios, registros, ranked, staff, logs), en este orden:
//   1. Canal guardado con /vants canal  (tabla discord_channels) + secret DISCORD_BOT_TOKEN
//   2. Secret DISCORD_CHANNEL_<CATEGORIA> + DISCORD_BOT_TOKEN
//   3. Secret DISCORD_WEBHOOK_<CATEGORIA>   (webhook del canal)
//   4. DISCORD_WEBHOOK_DEFAULT / DISCORD_CHANNEL_DEFAULT
// Si no hay destino, el evento se marca como "sin_canal" y no se reintenta.
// ============================================
import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const admin = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', { auth: { persistSession: false } });
const BOT_TOKEN = Deno.env.get('DISCORD_BOT_TOKEN') ?? Deno.env.get('DISCORD_TOKEN') ?? '';
const SITE = (Deno.env.get('VANTS_SITE_URL') ?? 'https://vantcall-esports1.pplx.app').replace(/\/$/, '');

type Category = 'anuncios' | 'registros' | 'ranked' | 'staff' | 'logs';
const CATEGORIES: Category[] = ['anuncios', 'registros', 'ranked', 'staff', 'logs'];

const COLORS = { red: 0xff4655, amber: 0xffb547, green: 0x3ddc84, blue: 0x5865f2, slate: 0x8b97a3, teal: 0x2ec4b6 };

const STATUS: Record<string, string> = {
  draft: 'Borrador', upcoming: 'Próximamente', registration: 'Inscripción abierta', open: 'Inscripción abierta',
  in_progress: 'En curso', live: 'En vivo', active: 'Activa', completed: 'Finalizado', finished: 'Finalizado',
  cancelled: 'Cancelado', closed: 'Cerrada', scheduled: 'Programado', going: 'Asistirá', maybe: 'Quizá', pending: 'Pendiente',
  approved: 'Aprobada', rejected: 'Rechazada', accepted: 'Aceptada',
};
const st = (s: unknown) => STATUS[String(s ?? '')] ?? String(s ?? '—');
const clip = (s: unknown, n = 200) => { const t = String(s ?? '').replace(/@(everyone|here)/g, '@\u200b$1'); return t.length > n ? t.slice(0, n - 1) + '…' : t; };
const ts = (d: unknown, style = 'F') => { const t = Date.parse(String(d ?? '')); return Number.isFinite(t) ? `<t:${Math.floor(t / 1000)}:${style}>` : '—'; };
const link = (path: string) => `${SITE}/#/${path}`;

type Embed = { title: string; description?: string; color: number; url?: string; fields?: { name: string; value: string; inline?: boolean }[]; footer?: { text: string }; timestamp?: string; thumbnail?: { url: string } };
type Rendered = { category: Category; embed: Embed } | null;

function render(type: string, p: Record<string, unknown>): Rendered {
  const f = (name: string, value: unknown, inline = true) => ({ name, value: clip(value ?? '—', 1000) || '—', inline });
  switch (true) {
    case type === 'registro':
      return { category: 'registros', embed: { title: 'Nuevo jugador en VANTS', color: COLORS.green, description: `Bienvenido **${clip(p.username, 40)}** a la plataforma.`, url: link(`jugador/${encodeURIComponent(String(p.username ?? ''))}`), fields: [f('Acceso', String(p.proveedor ?? 'correo'))] } };
    case type === 'torneo_publicado':
      return { category: 'anuncios', embed: { title: `Nuevo torneo: ${clip(p.name, 90)}`, color: COLORS.red, url: p.slug ? link(`torneo/${encodeURIComponent(String(p.slug))}`) : link('torneos'), fields: [f('Estado', st(p.status)), f('Formato', st(p.format)), f('Plazas', p.max ?? '—'), f('Premio', p.prize_pool ?? '—'), f('Empieza', ts(p.starts_at), false), ...(p.registration_closes_at ? [f('Cierre de inscripción', ts(p.registration_closes_at), false)] : [])] } };
    case type === 'torneo_estado':
      return { category: 'anuncios', embed: { title: `${clip(p.name, 90)} — ${st(p.status)}`, color: p.status === 'cancelled' ? COLORS.slate : p.status === 'completed' ? COLORS.amber : COLORS.red, url: p.slug ? link(`torneo/${encodeURIComponent(String(p.slug))}`) : link('torneos'), fields: [f('Antes', st(p.old_status)), f('Ahora', st(p.status)), f('Inscritos', `${p.current ?? 0}/${p.max ?? '—'}`)] } };
    case type === 'torneo_inscripcion':
      return { category: 'registros', embed: { title: 'Inscripción a torneo', color: COLORS.teal, description: `**${clip(p.player, 40)}** se inscribió en **${clip(p.tournament, 80)}**.`, url: p.slug ? link(`torneo/${encodeURIComponent(String(p.slug))}`) : undefined, fields: [f('Plazas', `${p.current ?? 0}/${p.max ?? '—'}`)] } };
    case type === 'torneo_resultado':
      return { category: 'ranked', embed: { title: `Resultado · ${clip(p.tournament, 80)}`, color: COLORS.amber, description: `**${clip(p.p1, 40)}** ${p.s1 ?? 0} — ${p.s2 ?? 0} **${clip(p.p2, 40)}**`, url: p.slug ? link(`torneo/${encodeURIComponent(String(p.slug))}`) : undefined, fields: [f('Ronda', p.round ?? '—'), f('Ganador', p.winner ?? '—')] } };
    case type === 'evento_publicado':
      return { category: 'anuncios', embed: { title: `Nuevo evento: ${clip(p.title, 90)}`, color: COLORS.blue, url: link('calendario'), fields: [f('Tipo', p.type ?? '—'), f('Lugar', p.location ?? 'Online'), f('Aforo', p.max ?? 'Libre'), f('Empieza', ts(p.starts_at), false)], ...(typeof p.image_url === 'string' && p.image_url.startsWith('https://') ? { thumbnail: { url: p.image_url } } : {}) } };
    case type === 'evento_estado':
      return { category: 'anuncios', embed: { title: `${clip(p.title, 90)} — ${st(p.status)}`, color: COLORS.blue, url: link('calendario'), fields: [f('Fecha', ts(p.starts_at), false)] } };
    case type === 'evento_asistencia':
      return { category: 'registros', embed: { title: 'Confirmación de asistencia', color: COLORS.blue, description: `**${clip(p.player, 40)}** · ${st(p.status)} · **${clip(p.event, 80)}**` } };
    case type.startsWith('temporada_'):
      return { category: 'anuncios', embed: { title: `${clip(p.name || `Temporada ${p.number}`, 80)} — ${st(p.status)}`, color: COLORS.amber, url: link('ranked'), description: p.status === 'active' ? 'La temporada ranked ha comenzado. Juega tus partidas de placement para entrar en el leaderboard.' : p.status === 'closed' ? 'La temporada ha terminado. Gracias por competir.' : 'Nueva temporada anunciada.', fields: [f('Inicio', ts(p.start_date, 'D')), f('Fin', ts(p.end_date, 'D'))] } };
    case type === 'ranked_resultado': {
      const winner = p.result === 'player1_win' ? p.p1 : p.result === 'player2_win' ? p.p2 : null;
      const sign = (n: unknown) => { const v = Number(n ?? 0); return v > 0 ? `+${v}` : String(v); };
      return { category: 'ranked', embed: { title: 'Partida ranked finalizada', color: COLORS.red, url: link('ranked'), description: `**${clip(p.p1, 40)}** vs **${clip(p.p2, 40)}**${winner ? `\nGanador: **${clip(winner, 40)}**` : p.result === 'draw' ? '\nEmpate' : ''}`, fields: [f(clip(p.p1, 40), `${sign(p.mmr_p1)} MMR`), f(clip(p.p2, 40), `${sign(p.mmr_p2)} MMR`)] } };
    }
    case type === 'plan_activado':
      return { category: 'staff', embed: { title: `Plan ${String(p.tier ?? '').toUpperCase()} activado`, color: p.tier === 'elite' ? COLORS.amber : COLORS.red, description: `**${clip(p.player, 40)}** (@${clip(p.username, 32)})`, fields: [f('Origen', p.source ?? '—'), f('Caduca', p.expires_at ? ts(p.expires_at, 'D') : 'No caduca')] } };
    case type === 'ticket_creado':
      return { category: 'staff', embed: { title: `Ticket de soporte: ${clip(p.subject, 90)}`, color: p.priority === 'high' || p.priority === 'urgent' ? COLORS.red : COLORS.slate, fields: [f('Jugador', `${clip(p.player, 40)} (@${clip(p.username, 32)})`), f('Categoría', p.category ?? 'general'), f('Prioridad', p.priority ?? 'normal'), ...(p.discord_id ? [f('Discord', `<@${String(p.discord_id).replace(/\D/g, '')}>`)] : [])] } };
    case type === 'postulacion_creada':
      return { category: 'staff', embed: { title: 'Nueva postulación', color: COLORS.teal, description: `**${clip(p.player, 40)}** (@${clip(p.username, 32)})${p.discord_id ? ` · <@${String(p.discord_id).replace(/\D/g, '')}>` : ''}` } };
    case type === 'postulacion_estado':
      return { category: 'staff', embed: { title: `Postulación ${st(p.status).toLowerCase()}`, color: COLORS.teal, description: `**${clip(p.player, 40)}** · revisada por ${clip(p.reviewed_by ?? 'staff', 40)}` } };
    case type === 'checkout_iniciado':
      return { category: 'logs', embed: { title: 'Checkout iniciado', color: COLORS.slate, fields: [f('Plan', p.plan ?? '—'), f('Precio', p.precio ?? '—')] } };
    case type === 'inicio_sesion': case type === 'cierre_sesion': case type === 'visita_precios': case type === 'ticket_soporte':
      return { category: 'logs', embed: { title: ({ inicio_sesion: 'Inicio de sesión', cierre_sesion: 'Cierre de sesión', visita_precios: 'Visita a precios', ticket_soporte: 'Ticket enviado desde la web' } as Record<string, string>)[type], color: COLORS.slate } };
    default:
      return { category: 'logs', embed: { title: `Evento: ${clip(type, 80)}`, color: COLORS.slate } };
  }
}

type Target = { kind: 'bot'; channelId: string } | { kind: 'webhook'; url: string };
const WEBHOOK_RE = /^https:\/\/(?:discord\.com|discordapp\.com|ptb\.discord\.com|canary\.discord\.com)\/api\/webhooks\/\d{17,20}\/[\w-]{20,}$/;

let channelCache: Map<string, string> | null = null;
async function dbChannels(): Promise<Map<string, string>> {
  if (channelCache) return channelCache;
  const { data } = await admin.from('discord_channels').select('category, channel_id');
  channelCache = new Map((data ?? []).map((r) => [r.category as string, r.channel_id as string]));
  return channelCache;
}

async function targetFor(category: Category): Promise<Target | null> {
  const db = await dbChannels();
  const up = category.toUpperCase();
  const channel = db.get(category) ?? Deno.env.get(`DISCORD_CHANNEL_${up}`) ?? null;
  if (BOT_TOKEN && channel && /^\d{17,20}$/.test(channel)) return { kind: 'bot', channelId: channel };
  const hook = Deno.env.get(`DISCORD_WEBHOOK_${up}`);
  if (hook && WEBHOOK_RE.test(hook)) return { kind: 'webhook', url: hook };
  if (category === 'logs') return null; // los logs solo se envían si tienen canal propio
  const defChannel = Deno.env.get('DISCORD_CHANNEL_DEFAULT');
  if (BOT_TOKEN && defChannel && /^\d{17,20}$/.test(defChannel)) return { kind: 'bot', channelId: defChannel };
  const defHook = Deno.env.get('DISCORD_WEBHOOK_DEFAULT');
  if (defHook && WEBHOOK_RE.test(defHook)) return { kind: 'webhook', url: defHook };
  return null;
}

async function send(target: Target, embed: Embed): Promise<{ ok: boolean; status: number; retryAfter?: number; error?: string }> {
  const body = JSON.stringify({ embeds: [{ ...embed, footer: { text: 'VANTS · vantcall esports' }, timestamp: new Date().toISOString() }], allowed_mentions: { parse: [] } });
  const url = target.kind === 'bot' ? `https://discord.com/api/v10/channels/${target.channelId}/messages` : `${target.url}?wait=true`;
  const headers: Record<string, string> = { 'Content-Type': 'application/json', 'User-Agent': 'VANTS-Notify (https://vantcall-esports1.pplx.app, 1.0)' };
  if (target.kind === 'bot') headers.Authorization = `Bot ${BOT_TOKEN}`;
  const r = await fetch(url, { method: 'POST', headers, body, signal: AbortSignal.timeout(8000) });
  if (r.ok) return { ok: true, status: r.status };
  const text = await r.text().catch(() => '');
  let retryAfter: number | undefined;
  try { retryAfter = JSON.parse(text).retry_after; } catch { /* ignore */ }
  return { ok: false, status: r.status, retryAfter, error: text.slice(0, 300) };
}

type Row = { id: string; event_type: string; payload: Record<string, unknown> | null; processed: boolean; discord_attempts: number };

async function deliver(row: Row): Promise<string> {
  if (row.processed) return 'ya_entregado';
  const out = render(row.event_type, row.payload ?? {});
  const finish = (patch: Record<string, unknown>) => admin.from('vant_sync_events').update(patch).eq('id', row.id).eq('processed', false);
  if (!out) { await finish({ processed: true, processed_at: new Date().toISOString(), discord_status: 'ignorado' }); return 'ignorado'; }
  const target = await targetFor(out.category);
  if (!target) { await finish({ processed: true, processed_at: new Date().toISOString(), discord_status: `sin_canal:${out.category}` }); return 'sin_canal'; }
  try {
    const res = await send(target, out.embed);
    if (res.ok) { await finish({ processed: true, processed_at: new Date().toISOString(), discord_status: `enviado:${out.category}`, discord_error: null }); return 'enviado'; }
    const permanent = res.status === 400 || res.status === 401 || res.status === 403 || res.status === 404;
    await finish({ discord_attempts: row.discord_attempts + 1, discord_status: permanent ? 'error_permanente' : 'reintentar', discord_error: `${res.status} ${res.error ?? ''}`.slice(0, 300), ...(permanent ? { processed: true, processed_at: new Date().toISOString() } : {}) });
    return permanent ? 'error_permanente' : 'reintentar';
  } catch (e) {
    await finish({ discord_attempts: row.discord_attempts + 1, discord_status: 'reintentar', discord_error: String(e).slice(0, 300) });
    return 'reintentar';
  }
}

let cachedSecret: string | null = null;
async function authorized(req: Request): Promise<boolean> {
  const given = req.headers.get('x-vants-notify') ?? '';
  if (given.length < 32) return false;
  if (!cachedSecret) {
    const { data } = await admin.rpc('get_discord_notify_secret');
    cachedSecret = typeof data === 'string' ? data : null;
  }
  if (!cachedSecret || cachedSecret.length !== given.length) return false;
  let diff = 0;
  for (let i = 0; i < given.length; i++) diff |= given.charCodeAt(i) ^ cachedSecret.charCodeAt(i);
  return diff === 0;
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (!(await authorized(req))) return json({ error: 'unauthorized' }, 401);

  if (req.method === 'GET') {
    const db = await dbChannels();
    const report: Record<string, string> = {};
    for (const c of CATEGORIES) {
      const t = await targetFor(c);
      report[c] = t ? (t.kind === 'bot' ? (db.has(c) ? 'bot+canal_configurado' : 'bot+secret_canal') : 'webhook') : 'sin_destino';
    }
    return json({ bot_token: Boolean(BOT_TOKEN), destinos: report });
  }
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const body = await req.json().catch(() => ({}));
  if (typeof body?.id === 'string') {
    const { data } = await admin.from('vant_sync_events').select('id, event_type, payload, processed, discord_attempts').eq('id', body.id).maybeSingle();
    if (!data) return json({ error: 'not_found' }, 404);
    return json({ result: await deliver(data as Row) });
  }
  if (body?.retry) {
    const since = new Date(Date.now() - 2 * 86400_000).toISOString();
    const { data } = await admin.from('vant_sync_events').select('id, event_type, payload, processed, discord_attempts')
      .eq('processed', false).lt('discord_attempts', 5).gt('created_at', since).order('created_at').limit(25);
    const results: Record<string, number> = {};
    for (const row of (data ?? []) as Row[]) {
      const r = await deliver(row);
      results[r] = (results[r] ?? 0) + 1;
      await new Promise((ok) => setTimeout(ok, 350)); // margen frente al rate limit de Discord
    }
    return json({ results });
  }
  return json({ error: 'bad_request' }, 400);
});
