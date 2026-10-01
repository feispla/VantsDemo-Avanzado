// ============================================
// VANTCALL Esports — Auth (Supabase: correo, Discord, Google y Steam) + cuenta + zona de plan + Stripe
// Usa el cliente compartido de db.js (proyecto qtetsgwwsvqzquxssudj)
// ============================================
(function () {
  'use strict';

  const PLANS = {
    basic: { name: 'VANT BASIC', price: 9, link: 'https://buy.stripe.com/aFaaEX7Ff9FufJ4gQlebu01' },
    pro:   { name: 'VANT PRO',   price: 19, link: 'https://buy.stripe.com/4gMeVd3oZ2d2eF0eIdebu02' },
    elite: { name: 'VANT ELITE', price: 39, link: 'https://buy.stripe.com/aFa4gz7Ff6ti68u7fLebu03' },
  };
  const PLAN_RANK = { free: 0, basic: 1, pro: 2, elite: 3 };
  const PLAYER_COLS = 'id, username, display_name, avatar_url, region, summoner_name, verified, created_at, main_game, country';
  const USERNAME_RE = /^[A-Za-z0-9_.\-]{3,16}$/;

  const sb = window.VantDB && window.VantDB.client;
  const SUPABASE_URL = window.VantDB && window.VantDB.url;
  const SUPABASE_KEY = window.VantDB && window.VantDB.key;

  let session = null;
  let me = null; // { player, discord, plan, profile, steam, perks }
  let providers = null;

  const mem = new Map();
  const flags = { get: (k) => (mem.has(k) ? mem.get(k) : null), set: (k, v) => mem.set(k, String(v)), del: (k) => mem.delete(k) };

  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const baseUrl = () => window.location.origin + window.location.pathname;
  const go = (route) => { if (window.location.hash !== '#/' + route) window.location.hash = '#/' + route; else if (typeof router === 'function') router(); };

  const ERRORS = [
    [/invalid login credentials/i, 'Correo o contraseña incorrectos.'],
    [/email not confirmed/i, 'Tu correo aún no está confirmado. Revisa tu bandeja de entrada (y spam).'],
    [/user already registered|already been registered/i, 'Ya existe una cuenta con este correo. Inicia sesión o recupera tu contraseña.'],
    [/password should be|weak password|password is too weak/i, 'La contraseña es demasiado débil.'],
    [/rate limit|too many|security purposes/i, 'Demasiados intentos. Espera un minuto y vuelve a probar.'],
    [/provider is not enabled|unsupported provider/i, 'Este método de inicio de sesión no está activado en este momento.'],
    [/flow state|code verifier|both auth code and code verifier/i, 'El inicio de sesión anterior quedó a medias. Pulsa de nuevo el botón para empezar uno nuevo.'],
    [/manual linking is disabled/i, 'La vinculación manual de cuentas está desactivada en Supabase (Authentication → Sign In / Providers → Allow manual linking).'],
    [/identity is already linked|already linked to another user/i, 'Esa cuenta ya está vinculada a otro usuario de VANTS.'],
    [/same.*password|different from the old/i, 'La nueva contraseña debe ser distinta a la anterior.'],
    [/invalid email|unable to validate email/i, 'El correo no es válido.'],
    [/duplicate key|unique/i, 'Ya existe un registro igual.'],
    [/row-level security|permission denied/i, 'No tienes permiso para esta acción. Inicia sesión de nuevo.'],
    [/failed to fetch|network/i, 'Sin conexión con el servidor. Revisa tu conexión e inténtalo de nuevo.'],
  ];
  const humanError = (e) => {
    const msg = (e && (e.message || e.error_description || e.msg)) || String(e);
    for (const [re, txt] of ERRORS) if (re.test(msg)) return txt;
    return 'No se pudo completar la operación: ' + msg;
  };

  function showMsg(el, text, kind) {
    if (!el) return;
    el.textContent = text;
    el.className = 'auth-msg auth-msg-' + (kind || 'info');
    el.hidden = !text;
  }

  function setBusy(form, busy, label) {
    const btn = form.querySelector('button[type="submit"]');
    if (!btn) return;
    if (busy) { btn.dataset.label = btn.textContent; btn.textContent = label || 'Procesando…'; btn.disabled = true; }
    else { btn.textContent = btn.dataset.label || btn.textContent; btn.disabled = false; }
  }

  function passwordProblem(p) {
    if (p.length < 12) return 'La contraseña debe tener al menos 12 caracteres.';
    if (!/[A-Z]/.test(p) || !/[a-z]/.test(p) || !/[0-9]/.test(p)) return 'Usa al menos una mayúscula, una minúscula y un número.';
    return '';
  }

  async function logEvent(type, data) {
    if (!sb || !session) return;
    try { await sb.rpc('log_web_event', { event_type: type, data: data || {} }); } catch (_) { /* no bloquear la UI */ }
  }

  async function loadMe() {
    if (!sb || !session) { me = null; return null; }
    const { data: pid } = await sb.rpc('current_player_id');
    const { data: player } = pid ? await sb.from('players').select(PLAYER_COLS).eq('id', pid).maybeSingle() : { data: null };
    if (!player) { me = { player: null, discord: null, plan: 'free', profile: null, steam: null, perks: [] }; return me; }
    const [disc, prof, ent, steam, perks] = await Promise.all([
      sb.from('player_discord_accounts').select('discord_id, discord_username, avatar_url').eq('player_id', player.id).maybeSingle(),
      sb.from('profiles').select('bio, visibility').eq('player_id', player.id).maybeSingle(),
      sb.from('entitlements').select('tier, is_active, expires_at').eq('player_id', player.id).eq('is_active', true),
      sb.from('user_game_accounts').select('handle, display_name, avatar_url, profile_url, verified').eq('user_id', session.user.id).eq('game', 'steam').maybeSingle(),
      sb.from('plan_content').select('tier, kind, title, body, cta_label, cta_url, sort_order').eq('published', true).order('tier').order('sort_order'),
    ]);
    let plan = 'free';
    for (const e of ent.data || []) {
      const t = String(e.tier || '').toLowerCase();
      if (PLAN_RANK[t] > PLAN_RANK[plan] && (!e.expires_at || new Date(e.expires_at) > new Date())) plan = t;
    }
    me = { player, discord: disc.data || null, profile: prof.data || null, plan, steam: (steam && steam.data) || null, perks: (perks && perks.data) || [] };
    return me;
  }

  async function loadProviders() {
    if (providers) return providers;
    try {
      const r = await fetch(SUPABASE_URL + '/auth/v1/settings', { headers: { apikey: SUPABASE_KEY } });
      providers = (await r.json()).external || {};
    } catch (_) { providers = {}; }
    return providers;
  }

  function displayName() {
    if (!session) return '';
    const u = session.user;
    return (me && me.player && (me.player.display_name || me.player.username)) || (u.user_metadata && (u.user_metadata.full_name || u.user_metadata.name)) || (u.email || '').split('@')[0];
  }

  function updateHeader() {
    const link = document.getElementById('auth-link');
    const label = document.getElementById('auth-link-label');
    if (!link || !label) return;
    if (session) {
      const plan = me && me.plan !== 'free' ? ' · ' + me.plan.toUpperCase() : '';
      label.textContent = displayName() + plan;
      link.setAttribute('href', '#/cuenta');
      link.setAttribute('aria-label', 'Mi cuenta');
    } else {
      label.textContent = 'Login';
      link.setAttribute('href', '#/login');
      link.setAttribute('aria-label', 'Iniciar sesión');
    }
    document.querySelectorAll('[data-auth-cta]').forEach((a) => {
      a.setAttribute('href', session ? '#/cuenta' : '#/login');
      a.textContent = session ? 'MI CUENTA' : 'JUGAR GRATIS';
    });
  }

  const ICON_DISCORD = typeof DISCORD_SVG === 'string' ? DISCORD_SVG : '';
  const ICON_GOOGLE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M23.5 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.45a5.5 5.5 0 0 1-2.4 3.62v3h3.88c2.27-2.09 3.57-5.17 3.570-8.81z"/><path fill="#34A853" d="M12 24c3.24 0 5.960-1.07 7.94-2.91l-3.88-3c-1.07.72-2.45 1.15-4.06 1.15-3.12 0-5.77-2.11-6.71-4.95H1.28v3.1A12 12 0 0 0 12 24z"/><path fill="#FBBC05" d="M5.29 14.29A7.2 7.2 0 0 1 4.91 12c0-.8.14-1.57.38-2.29v-3.1H1.28A12 12 0 0 0 0 12c0 1.94.46 3.77 1.28 5.39l4.01-3.1z"/><path fill="#EA4335" d="M12 4.77c1.76 0 3.34.61 4.59 1.8l3.44-3.44C17.95 1.19 15.24 0 12 0A12 12 0 0 0 1.28 6.61l4.01 3.1C6.23 6.88 8.88 4.77 12 4.77z"/></svg>';
  const ICON_STEAM = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M11.98 0C5.67 0 .5 4.86.02 11.04l6.43 2.66a3.38 3.38 0 0 1 1.92-.6l.19.01 2.86-4.15v-.06a4.52 4.52 0 1 1 4.52 4.52h-.1l-4.08 2.91v.16a3.39 3.39 0 0 1-6.72.63L.4 15.5A12 12 0 1 0 11.98 0zM7.54 18.21l-1.47-.61a2.54 2.54 0 1 0 1.39-3.46l1.52.63a1.87 1.87 0 1 