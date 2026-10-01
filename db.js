// ============================================
// VANTCALL — Cliente Supabase compartido + capa de datos reales
// Proyecto: VantsDEMOPRUEBA (qtetsgwwsvqzquxssudj)
// La clave publicable es pública por diseño; el acceso lo controla RLS.
// ============================================
(function () {
  'use strict';

  const SUPABASE_URL = 'https://qtetsgwwsvqzquxssudj.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_Wd5NBpT9pqEJV4Gw4jJB7w_hFXYvYtm';

  const lib = window.supabase;
  const client = lib && lib.createClient
    ? lib.createClient(SUPABASE_URL, SUPABASE_KEY, {
        auth: { flowType: 'pkce', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
      })
    : null;

  // Caché corta en memoria para no repetir consultas al navegar
  const cache = new Map();
  const TTL = 30 * 1000;
  async function cached(key, fn) {
    const hit = cache.get(key);
    if (hit && Date.now() - hit.t < TTL) return hit.v;
    const v = await fn();
    cache.set(key, { t: Date.now(), v });
    return v;
  }
  function invalidate(prefix) {
    for (const k of cache.keys()) if (!prefix || k.startsWith(prefix)) cache.delete(k);
  }

  async function q(builder) {
    const { data, error } = await builder;
    if (error) throw error;
    return data;
  }

  const DB = {
    client,
    url: SUPABASE_URL,
    key: SUPABASE_KEY,
    invalidate,

    stats: () => cached('stats', async () => {
      const count = async (t, f) => {
        let b = client.from(t).select('id', { count: 'exact', head: true });
        if (f) b = f(b);
        const { count: c, error } = await b;
        if (error) throw error;
        return c || 0;
      };
      const [players, tournaments, events, matches] = await Promise.all([
        count('players'),
        count('tournaments'),
        count('events', (b) => b.gte('starts_at', new Date().toISOString())),
        count('ranked_matches', (b) => b.eq('status', 'completed')),
      ]);
      return { players, tournaments, events, matches };
    }),

    activeSeason: () => cached('season', async () => {
      const rows = await q(client.from('seasons').select('*').order('season_number', { ascending: false }).limit(5));
      return rows.find((s) => s.status === 'active') || rows[0] || null;
    }),

    rules: () => cached('rules', () => q(client.from('ranked_rules').select('rule_key, rule_value, description').order('rule_key'))),

    leaderboard: (seasonId, limit = 50) => cached('lb:' + seasonId + ':' + limit, () => {
      if (!seasonId) return [];
      return q(client.from('leaderboard').select('*').eq('season_id', seasonId).order('mmr', { ascending: false }).limit(limit));
    }),

    tournaments: () => cached('tournaments', () => q(client.from('tournaments').select('*').neq('status', 'draft').order('starts_at', { ascending: true, nullsFirst: false }))),

    tournament: (slug) => cached('t:' + slug, async () => {
      const t = await q(client.from('tournaments').select('*').eq('slug', slug).maybeSingle());
      if (!t) return null;
      const [entries, matches] = await Promise.all([
        q(client.from('tournament_entries').select('id, status, seed, registered_at, player:players(id, username, display_name, avatar_url, region)').eq('tournament_id', t.id).order('seed', { ascending: true, nullsFirst: false })),
        q(client.from('tournament_matches').select('*, p1:players!tournament_matches_player1_id_fkey(username, display_name), p2:players!tournament_matches_player2_id_fkey(username, display_name)').eq('tournament_id', t.id).order('round').order('match_number')),
      ]);
      return { ...t, entries, matches };
    }),

    events: () => cached('events', () => q(client.from('events').select('*').order('starts_at', { ascending: true }))),

    scheduledMatches: () => cached('tmatches', () => q(
      client.from('tournament_matches')
        .select('id, round, match_number, status, scheduled_at, player1_score, player2_score, winner_id, player1_id, player2_id, tournament:tournaments(name, slug), p1:players!tournament_matches_player1_id_fkey(username, display_name), p2:players!tournament_matches_player2_id_fkey(username, display_name)')
        .not('scheduled_at', 'is', null)
        .order('scheduled_at', { ascending: true })
        .limit(200)
    )),

    players: (search) => cached('players:' + (search || ''), () => {
      let b = client.from('players').select('id, username, display_name, avatar_url, region, main_game, verified, created_at').order('created_at', { ascending: false }).limit(100);
      if (search) b = b.or(`username.ilike.%${search.replace(/[%,()]/g, '')}%,display_name.ilike.%${search.replace(/[%,()]/g, '')}%`);
      return q(b);
    }),

    player: (username) => cached('p:' + username, async () => {
      const p = await q(client.from('players').select('id, username, display_name, avatar_url, region, summoner_name, verified, created_at, main_game, country').eq('username', username).maybeSingle());
      if (!p) return null;
      const [profile, stats, matches, entries] = await Promise.all([
        q(client.from('profiles').select('bio, visibility, stats').eq('player_id', p.id).maybeSingle()),
        q(client.from('season_player_stats').select('mmr, rank, wins, losses, placement_done, season:seasons(name, season_number, status)').eq('player_id', p.id)),
        q(client.from('ranked_matches').select('id, result, status, mmr_change_p1, mmr_change_p2, player1_id, player2_id, completed_at, created_at').or(`player1_id.eq.${p.id},player2_id.eq.${p.id}`).order('created_at', { ascending: false }).limit(20)),
        q(client.from('tournament_entries').select('status, registered_at, tournament:tournaments(name, slug, status, starts_at)').eq('player_id', p.id)),
      ]);
      return { ...p, profile, stats, matches, entries };
    }),
  };

  window.VantDB = DB;
})();
