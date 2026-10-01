// ============================================
// steam-login — Iniciar sesión (o vincular) con Steam vía OpenID 2.0
//
//  GET  /steam-login?redirect_to=<url permitida>          → login: 302 a Steam
//  POST /steam-login {redirect_to}  + Authorization: Bearer <jwt>
//                                                        → vincular: {login_url}
//  GET  /steam-login?state=<uuid>&openid.*               → callback de Steam
//
// Al volver, redirige a redirect_to con:
//   ?steam_token=<token_hash>&steam_type=magiclink   (login correcto → verifyOtp en el cliente)
//   ?steam_linked=1                                  (vinculación correcta)
//   ?steam_error=<motivo>                            (cualquier fallo)
//
// Seguridad: state de un solo uso (10 min) en public.steam_login_state, return_to exacto,
// campos firmados obligatorios, nonce reciente, check_authentication contra Steam y
// lista cerrada de redirect_to. STEAM_WEB_API_KEY y service_role nunca salen del backend.
// ============================================
import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL = (Deno.env.get('SUPABASE_URL') ?? '').replace(/\/$/, '');
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const FN_URL = `${SUPABASE_URL}/functions/v1/steam-login`;

const STEAM_OPENID = 'https://steamcommunity.com/openid/login';
const OPENID_NS = 'http://specs.openid.net/auth/2.0';
const SELECTOR = 'http://specs.openid.net/auth/2.0/identifier_select';
const REQUIRED_SIGNED = ['op_endpoint', 'claimed_id', 'identity', 'return_to', 'response_nonce', 'assoc_handle'];
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Solo estos destinos pueden recibir el token. Ampliable con STEAM_LOGIN_REDIRECTS (coma).
const DEFAULT_REDIRECTS = ['https://vantsports.pplx.app/', 'https://vantcall-esports1.pplx.app/', 'vants://auth/callback'];
const ALLOWED = [
  ...DEFAULT_REDIRECTS,
  ...(Deno.env.get('STEAM_LOGIN_REDIRECTS') ?? '').split(',').map((s) => s.trim()).filter(Boolean),
];

const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false, autoRefreshToken: false } });

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });

function allowedRedirect(raw: string | null): string | null {
  if (!raw || raw.length > 300) return null;
  let u: URL;
  try { u = new URL(raw); } catch { return null; }
  u.hash = '';
  const clean = u.toString();
  // Coincidencia exacta de origen + ruta (los query params propios se sustituyen al volver)
  const base = `${u.protocol}//${u.host}${u.pathname}`;
  return ALLOWED.some((a) => a === base || a === clean) ? base : null;
}

function back(redirectTo: string, params: Record<string, string>): Response {
  const target = new URL(redirectTo);
  for (const [k, v] of Object.entries(params)) target.searchParams.set(k, v);
  return new Response(null, { status: 302, headers: { Location: target.toString(), 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' } });
}

async function createState(redirectTo: string, userId: string | null): Promise<string | null> {
  // Limpieza oportunista de states caducados
  await admin.from('steam_login_state').delete().lt('expires_at', new Date().toISOString());
  const { data, error } = await admin.from('steam_login_state').insert({ redirect_to: redirectTo, user_id: userId }).select('state_id').single();
  return error || !data ? null : data.state_id as string;
}

function steamUrl(state: string): string {
  const returnTo = new URL(FN_URL);
  returnTo.searchParams.set('state', state);
  const p = new URLSearchParams({
    'openid.ns': OPENID_NS,
    'openid.mode': 'checkid_setup',
    'openid.return_to': returnTo.toString(),
    'openid.realm': `${SUPABASE_URL}/functions/v1/`,
    'openid.identity': SELECTOR,
    'openid.claimed_id': SELECTOR,
  });
  return `${STEAM_OPENID}?${p.toString()}`;
}

async function verifyOpenId(url: URL, state: string): Promise<string | null> {
  const sp = url.searchParams;
  if (sp.get('openid.mode') !== 'id_res' || sp.get('openid.ns') !== OPENID_NS || sp.get('openid.op_endpoint') !== STEAM_OPENID) return null;
  const expected = new URL(FN_URL); expected.searchParams.set('state', state);
  if (sp.get('openid.return_to') !== expected.toString()) return null;
  const signed = new Set((sp.get('openid.signed') ?? '').split(','));
  if (REQUIRED_SIGNED.some((f) => !signed.has(f))) return null;
  const claimed = sp.get('openid.claimed_id') ?? '';
  const m = /^https:\/\/steamcommunity\.com\/openid\/id\/(\d{17})$/.exec(claimed);
  if (!m || sp.get('openid.identity') !== claimed) return null;
  const nonceTime = Date.parse((sp.get('openid.response_nonce') ?? '').slice(0, 20));
  if (!Number.isFinite(nonceTime) || nonceTime > Date.now() + 60_000 || nonceTime < Date.now() - 600_000) return null;

  const check = new URLSearchParams();
  for (const [k, v] of sp.entries()) {
    if (!k.startsWith('openid.')) continue;
    if (sp.getAll(k).length !== 1) return null;
    check.set(k, v);
  }
  check.set('openid.mode', 'check_authentication');
  try {
    const r = await fetch(STEAM_OPENID, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: check, signal: AbortSignal.timeout(10_000) });
    if (!r.ok || !/^is_valid:true\s*$/m.test(await r.text())) return null;
  } catch { return null; }
  return m[1];
}

type SteamSummary = { personaname?: string; avatarfull?: string; profileurl?: string; loccountrycode?: string };
async function steamSummary(steamId: string): Promise<SteamSummary> {
  const key = Deno.env.get('STEAM_WEB_API_KEY');
  if (!key) return {};
  try {
    const u = new URL('https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/');
    u.searchParams.set('key', key); u.searchParams.set('steamids', steamId);
    const r = await fetch(u, { signal: AbortSignal.timeout(10_000) });
    const p = (await r.json())?.response?.players?.[0];
    return p && p.steamid === steamId ? p : {};
  } catch { return {}; }
}

async function upsertSteamAccount(userId: string, steamId: string, s: SteamSummary) {
  const now = new Date().toISOString();
  return await admin.from('user_game_accounts').upsert({
    user_id: userId, game: 'steam', handle: steamId,
    display_name: typeof s.personaname === 'string' ? s.personaname : null,
    avatar_url: typeof s.avatarfull === 'string' ? s.avatarfull : null,
    profile_url: typeof s.profileurl === 'string' ? s.profileurl : null,
    country: typeof s.loccountrycode === 'string' ? s.loccountrycode : null,
    verified: true, verified_at: now, updated_at: now,
  }, { onConflict: 'user_id,game' });
}

async function handleCallback(url: URL): Promise<Response> {
  const state = url.searchParams.get('state') ?? '';
  if (!UUID_RE.test(state)) return new Response('Estado inválido', { status: 400 });

  // DELETE atómico: el state solo sirve una vez
  const { data: row } = await admin.from('steam_login_state').delete()
    .eq('state_id', state).gt('expires_at', new Date().toISOString())
    .select('redirect_to, user_id').maybeSingle();
  if (!row?.redirect_to || !allowedRedirect(row.redirect_to)) return new Response('Sesión de Steam caducada. Vuelve a intentarlo.', { status: 400 });
  const redirectTo = row.redirect_to as string;

  if (url.searchParams.get('openid.mode') === 'cancel') return back(redirectTo, { steam_error: 'cancelled' });
  const steamId = await verifyOpenId(url, state);
  if (!steamId) return back(redirectTo, { steam_error: 'verification_failed' });
  const summary = await steamSummary(steamId);

  // ---- Modo vincular (usuario ya autenticado) ----
  if (row.user_id) {
    const { error } = await upsertSteamAccount(row.user_id as string, steamId, summary);
    if (error) return back(redirectTo, { steam_error: error.code === '23505' ? 'already_linked' : 'link_failed' });
    return back(redirectTo, { steam_linked: '1' });
  }

  // ---- Modo login ----
  const { data: acct } = await admin.from('user_game_accounts').select('user_id')
    .eq('game', 'steam').eq('handle', steamId).eq('verified', true).maybeSingle();

  let userId = acct?.user_id as string | undefined;
  let email: string | undefined;

  if (userId) {
    const { data: u, error } = await admin.auth.admin.getUserById(userId);
    if (error || !u?.user) return back(redirectTo, { steam_error: 'login_failed' });
    email = u.user.email ?? undefined;
  } else {
    // Primera vez con Steam: se crea la cuenta VANTS. Steam no comparte correo, así que se usa
    // una dirección interna no enrutable (.invalid, RFC 2606). El usuario puede añadir su correo real después.
    email = `steam_${steamId}@steam.vants.invalid`;
    const name = (summary.personaname ?? '').trim().slice(0, 32) || `steam${steamId.slice(-6)}`;
    const { data: created, error } = await admin.auth.admin.createUser({
      email, email_confirm: true,
      user_metadata: { username: name, full_name: name, avatar_url: summary.avatarfull ?? null, steam_id: steamId, provider_hint: 'steam' },
      app_metadata: { steam_id: steamId },
    });
    if (error || !created?.user) return back(redirectTo, { steam_error: 'account_create_failed' });
    userId = created.user.id;
    const { error: linkErr } = await upsertSteamAccount(userId, steamId, summary);
    if (linkErr) return back(redirectTo, { steam_error: 'link_failed' });
  }
  if (!email) return back(redirectTo, { steam_error: 'login_failed' });

  const { data: link, error: linkError } = await admin.auth.admin.generateLink({ type: 'magiclink', email });
  const tokenHash = link?.properties?.hashed_token;
  if (linkError || !tokenHash) return back(redirectTo, { steam_error: 'login_failed' });
  return back(redirectTo, { steam_token: tokenHash, steam_type: 'magiclink' });
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (!SUPABASE_URL || !SERVICE_ROLE) return json({ error: 'misconfigured' }, 500);
  const url = new URL(req.url);

  try {
    // Callback de Steam
    if (req.method === 'GET' && url.searchParams.has('state')) return await handleCallback(url);

    // Inicio de login (sin sesión)
    if (req.method === 'GET') {
      const redirectTo = allowedRedirect(url.searchParams.get('redirect_to'));
      if (!redirectTo) return new Response('redirect_to no permitido', { status: 400 });
      const state = await createState(redirectTo, null);
      if (!state) return back(redirectTo, { steam_error: 'start_failed' });
      return new Response(null, { status: 302, headers: { Location: steamUrl(state), 'Cache-Control': 'no-store' } });
    }

    // Inicio de vinculación (con sesión)
    if (req.method === 'POST') {
      const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
      const { data: u, error } = jwt ? await admin.auth.getUser(jwt) : { data: null, error: true };
      if (error || !u?.user) return json({ error: 'unauthorized' }, 401);
      const body = await req.json().catch(() => ({}));
      const redirectTo = allowedRedirect(typeof body?.redirect_to === 'string' ? body.redirect_to : null);
      if (!redirectTo) return json({ error: 'redirect_not_allowed' }, 400);
      const state = await createState(redirectTo, u.user.id);
      if (!state) return json({ error: 'start_failed' }, 500);
      return json({ login_url: steamUrl(state), expires_in: 600 });
    }
    return json({ error: 'method_not_allowed' }, 405);
  } catch {
    return json({ error: 'internal_error' }, 500);
  }
});
