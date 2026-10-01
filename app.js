// ============================================
// VANTCALL Esports — App & Router (datos reales de Supabase)
// ============================================

const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const DISCORD_INVITE = 'https://discord.gg/rCHE7jvRS4';

const GAMES = { valorant: 'VALORANT', cs2: 'Counter-Strike 2', lol: 'League of Legends' };

// Rango VANTS: 8 niveles (vision/rangos). Umbrales orientativos por MMR.
const VANTS_RANKS = [
  { key: 'hierro', name: 'Hierro', min: 0, color: '#8a9099' },
  { key: 'bronce', name: 'Bronce', min: 900, color: '#b87333' },
  { key: 'plata', name: 'Plata', min: 1100, color: '#c9d1d9' },
  { key: 'oro', name: 'Oro', min: 1300, color: '#e5b93c' },
  { key: 'platino', name: 'Platino', min: 1500, color: '#2ec4b6' },
  { key: 'diamante', name: 'Diamante', min: 1700, color: '#9b6bff' },
  { key: 'titan', name: 'Titán', min: 1900, color: '#3ddc84' },
  { key: 'escarlata', name: 'Escarlata', min: 2100, color: '#ff4655' },
];
function rankFor(stat) {
  if (!stat) return VANTS_RANKS[0];
  const byName = stat.rank && VANTS_RANKS.find((r) => stat.rank.toLowerCase().startsWith(r.key.slice(0, 4)));
  if (byName) return byName;
  let r = VANTS_RANKS[0];
  for (const x of VANTS_RANKS) if ((stat.mmr || 0) >= x.min) r = x;
  return r;
}
// Emblemas de rango VANTS: cada nivel añade un elemento (chevrones → alas → gema → corona → halo)
const RANK_SHADES = {
  hierro: ['#c3c8cf', '#5d636b', '#2b2f35'], bronce: ['#f1b07a', '#b87333', '#4f2a10'], plata: ['#ffffff', '#b9c3cc', '#4f5a65'],
  oro: ['#fff0b3', '#e5b93c', '#7a5408'], platino: ['#b8fff6', '#2ec4b6', '#0b4f49'], diamante: ['#e3d4ff', '#9b6bff', '#3a1f7a'],
  titan: ['#c9ffe1', '#3ddc84', '#0d5a32'], escarlata: ['#ffd0a1', '#ff4655', '#5a0a14'],
};
function rankEmblem(r, size = 64) {
  const i = VANTS_RANKS.indexOf(r);
  const [hi, mid, lo] = RANK_SHADES[r.key] || ['#fff', r.color, '#000'];
  const id = 're-' + r.key;
  const chevrons = Math.min(3, (i % 3) + 1);
  const wings = i >= 3;
  const gem = i >= 5;
  const crown = i >= 6;
  const halo = i === 7;
  let chev = '';
  for (let c = 0; c < chevrons; c++) {
    const y = 40 + c * 7 - (chevrons - 1) * 3.5;
    chev += `<path d="M24 ${y} L32 ${y + 6} L40 ${y}" fill="none" stroke="url(#${id}-l)" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/>`;
  }
  return `<svg class="rank-emblem-svg" viewBox="0 0 64 64" width="${size}" height="${size}" aria-hidden="true">
    <defs>
      <linearGradient id="${id}-f" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${mid}"/><stop offset="1" stop-color="${lo}"/></linearGradient>
      <linearGradient id="${id}-l" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${hi}"/><stop offset="1" stop-color="${mid}"/></linearGradient>
      <radialGradient id="${id}-g" cx=".5" cy=".45" r=".55"><stop offset="0" stop-color="${mid}" stop-opacity=".55"/><stop offset="1" stop-color="${mid}" stop-opacity="0"/></radialGradient>
    </defs>
    ${halo ? `<circle cx="32" cy="32" r="30" fill="url(#${id}-g)"/><path d="M32 2 L35 9 L32 7 L29 9 Z M10 14 L16 17 L13 19 Z M54 14 L48 17 L51 19 Z" fill="${hi}" opacity=".9"/>` : ''}
    ${wings ? `<path d="M14 24 L2 20 L7 30 L3 36 L13 36 Z" fill="url(#${id}-l)" opacity=".85"/><path d="M50 24 L62 20 L57 30 L61 36 L51 36 Z" fill="url(#${id}-l)" opacity=".85"/>` : ''}
    <path d="M32 6 L50 14 L50 34 C50 45 42 53 32 58 C22 53 14 45 14 34 L14 14 Z" fill="url(#${id}-f)" stroke="url(#${id}-l)" stroke-width="2"/>
    <path d="M32 10 L46 16.5 L46 33.5 C46 42 40 48.5 32 52.5 C24 48.5 18 42 18 33.5 L18 16.5 Z" fill="none" stroke="${hi}" stroke-opacity=".28" stroke-width="1"/>
    ${gem ? `<path d="M32 18 L38 24 L32 32 L26 24 Z" fill="url(#${id}-l)"/><path d="M26 24 L38 24 L32 32 Z" fill="${lo}" opacity=".35"/>` : `<path d="M32 17 L35 22 L32 27 L29 22 Z" fill="url(#${id}-l)" opacity=".9"/>`}
    ${chev}
    ${crown ? `<path d="M22 8 L26 2 L29 6 L32 0 L35 6 L38 2 L42 8 Z" fill="url(#${id}-l)"/>` : ''}
  </svg>`;
}
function rankBadge(stat) {
  const r = rankFor(stat);
 feat/diseno-premium
  const label = stat && stat.placement_done === false ? 'Placement' : (stat && stat.rank ? stat.rank : r.name);
  return `<span class="rank-badge rank-${r.key}" style="--rank:${r.color}">${rankEmblem(r, 22)}${esc(label)}</span>`;

  const icon = window.VantsRanks ? VantsRanks.emblemUse(r.key, 'rank-badge-emblem') : '<span class="rank-gem"></span>';
  return `<span class="rank-badge" style="--rank:${r.color}">${icon}${esc(stat && stat.rank ? stat.rank : r.name)}</span>`;
 main
}

const fmtDate = (d, opts) => d ? new Date(d).toLocaleDateString('es-ES', opts || { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
const fmtTime = (d) => d ? new Date(d).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) : '';
// Clave de día en la zona horaria del visitante (antes se usaba UTC y los eventos nocturnos caían en el día siguiente)
const localDayKey = (d) => { const x = new Date(d); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`; };
const fmtDay = (d) => new Date(d).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'short' });
const initials = (s) => esc(String(s || '?').replace(/[^A-Za-z0-9]/g, '').slice(0, 3).toUpperCase() || '?');

const STATUS_LABEL = {
  draft: 'Borrador', single_elimination: 'Eliminación simple', double_elimination: 'Doble eliminación', round_robin: 'Liga (round robin)', swiss: 'Suizo', upcoming: 'Próximo', registration: 'Inscripción abierta', open: 'Inscripción abierta',
  in_progress: 'En curso', live: 'En vivo', active: 'Activo', completed: 'Finalizado', finished: 'Finalizado',
  cancelled: 'Cancelado', closed: 'Cerrado', scheduled: 'Programado', pending: 'Pendiente', registered: 'Inscrito',
  checked_in: 'Check-in', withdrawn: 'Retirado', disqualified: 'Descalificado',
};
const statusLabel = (s) => STATUS_LABEL[s] || (s ? String(s) : '—');
const statusPill = (s) => `<span class="pill pill-${esc(s || 'none')}">${esc(statusLabel(s))}</span>`;

function emptyState(title, text, cta) {
  return `<div class="empty-state">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M8 10L12 16L16 10"/><rect x="3" y="3" width="18" height="18" rx="2"/></svg>
    <h3>${esc(title)}</h3><p>${esc(text)}</p>${cta || ''}</div>`;
}
function errorState(err) {
  console.error(err);
  return `<div class="auth-msg auth-msg-error" role="alert">No se pudieron cargar los datos de Supabase. ${esc(err && err.message ? err.message : '')} <button type="button" class="link-btn" onclick="router()">Reintentar</button></div>`;
}
function skeleton(rows = 3) {
  return `<div class="skeleton-list">${'<div class="skeleton-row"></div>'.repeat(rows)}</div>`;
}
function liveTag() {
  return `<span class="live-data-tag" title="Datos en tiempo real desde Supabase"><span class="dot"></span>Datos en vivo</span>`;
}

// ============================================
// BLOQUES REUTILIZABLES
// ============================================

function tournamentCard(t) {
  return `<a class="t-card" href="#/torneo/${encodeURIComponent(t.slug)}">
    <div class="t-card-top">${statusPill(t.status)}${t.tier ? `<span class="t-tier">${esc(String(t.tier).toUpperCase())}</span>` : ''}</div>
    <h3>${esc(t.name)}</h3>
    <p>${esc(t.description || 'Torneo VANTCALL')}</p>
    <div class="t-card-meta">
      <span>${esc(statusLabel(t.format) || 'Formato por definir')}</span>
      <span>${t.current_participants || 0}${t.max_participants ? ' / ' + t.max_participants : ''} jugadores</span>
      <span>${fmtDate(t.starts_at)}</span>
    </div>
    ${t.prize_pool ? `<div class="t-prize">Premio: ${esc(t.prize_pool)}</div>` : ''}
  </a>`;
}

function leaderboardRows(rows) {
  return rows.map((r, i) => `
    <a class="ranking-row" href="#/jugador/${encodeURIComponent(r.username)}">
      <div class="ranking-pos${i === 0 ? ' top1' : i === 1 ? ' top2' : i === 2 ? ' top3' : ''}">${String(r.position || i + 1).padStart(2, '0')}</div>
      <div class="ranking-team">
        <div class="ranking-team-logo">${r.avatar_url ? `<img src="${esc(r.avatar_url)}" alt="" loading="lazy">` : initials(r.username)}</div>
        <div><div class="ranking-team-name">${esc(r.display_name || r.username)}</div><div class="ranking-sub">@${esc(r.username)} · ${r.wins || 0}V ${r.losses || 0}D</div></div>
      </div>
      <div class="ranking-right">${rankBadge(r)}<div class="ranking-points">${r.mmr || 0} MMR</div></div>
    </a>`).join('');
}

function matchRow(m) {
  const n1 = m.p1 ? (m.p1.display_name || m.p1.username) : 'Por determinar';
  const n2 = m.p2 ? (m.p2.display_name || m.p2.username) : 'Por determinar';
  const has = ['completed', 'finished', 'in_progress', 'live'].includes(m.status) && m.player1_score != null && m.player2_score != null;
  const w1 = m.winner_id && m.winner_id === m.player1_id;
  const w2 = m.winner_id && m.winner_id === m.player2_id;
  const live = m.status === 'in_progress' || m.status === 'live';
  return `<div class="match-card">
    <div class="match-time${live ? ' live' : ''}">${live ? '<span class="live-indicator">LIVE</span>' : fmtTime(m.scheduled_at)}</div>
    <div class="match-team"><div class="match-team-logo">${initials(n1)}</div><span class="match-team-name${m.p1 ? '' : ' tbd'}">${esc(n1)}</span></div>
    <div class="match-score">${has ? `<span class="match-score-num${w1 ? ' winner' : ''}">${m.player1_score}</span><span class="match-score-sep">:</span><span class="match-score-num${w2 ? ' winner' : ''}">${m.player2_score}</span>` : '<span class="match-score-sep">VS</span>'}</div>
    <div class="match-team right"><span class="match-team-name${m.p2 ? '' : ' tbd'}">${esc(n2)}</span><div class="match-team-logo">${initials(n2)}</div></div>
    <div class="match-format">
      ${m.tournament ? `<a class="match-comp" href="#/torneo/${encodeURIComponent(m.tournament.slug)}">${esc(m.tournament.name)}</a>` : ''}
      <span class="match-phase">Ronda ${m.round || 1} · Partida ${m.match_number || 1}</span>
      <span class="match-format-tag">${esc(statusLabel(m.status))}</span>
    </div>
  </div>`;
}

function eventRow(e) {
  return `<div class="match-card event-card" data-event="${esc(e.id)}">
    <div class="match-time">${fmtTime(e.starts_at)}</div>
    <div class="event-body">
      <div class="event-title">${esc(e.title)}</div>
      <div class="event-sub">${esc(e.event_type || 'Evento')}${e.location ? ' · ' + esc(e.location) : ''}${e.max_attendees ? ` · ${e.current_attendees || 0}/${e.max_attendees} plazas` : ''}</div>
    </div>
    <div class="match-format">${statusPill(e.status)}<button type="button" class="btn btn-secondary btn-sm" data-rsvp="${esc(e.id)}">Asistiré</button></div>
  </div>`;
}

function groupByDay(items, dateKey) {
  const groups = new Map();
  for (const it of items) {
    const k = localDayKey(it[dateKey]);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(it);
  }
  return [...groups.entries()];
}

feat/diseno-premium
const RANKS_STRIP = `<div class="ranks-ladder">${VANTS_RANKS.map((r, i) => {
  const next = VANTS_RANKS[i + 1];
  return `<div class="rank-tile rank-${r.key}${i === 7 ? ' is-apex' : i >= 5 ? ' is-high' : ''}" style="--rank:${r.color}">
    <span class="rank-tier-num">${String(i + 1).padStart(2, '0')}</span>
    <div class="rank-emblem">${rankEmblem(r, 72)}</div>
    <div class="rank-name">${r.name}</div>
    <div class="rank-min">${i === 7 ? r.min + '+ MMR · Top global' : `${r.min}–${next.min - 1} MMR`}</div>
    <div class="rank-bar" aria-hidden="true"><span style="width:${Math.round(((i + 1) / VANTS_RANKS.length) * 100)}%"></span></div>
  </div>`;
}).join('')}</div>`;

const RANKS_STRIP = `<div class="ranks-strip">${VANTS_RANKS.map((r, i) => `
  <div class="rank-tile${i >= 5 ? ' rank-tile-elite' : ''}${i === 7 ? ' rank-tile-apex' : ''}" style="--rank:${r.color}">
    <span class="rank-tier">${window.VantsRanks ? VantsRanks.RANK_ART[r.key].tier : i + 1}</span>
    <div class="rank-emblem">${window.VantsRanks ? VantsRanks.emblemUse(r.key, 'rank-svg') : ''}</div>
    <div class="rank-name">${r.name}</div><div class="rank-min">${i === 7 ? 'Top global' : r.min + '+ MMR'}</div>
  </div>`).join('')}</div>`;
main

const DISCORD_SVG = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994.021-.041.001-.09-.041-.106a13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128c.126-.094.252-.192.372-.291a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.009c.12.099.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/></svg>';

// ============================================
// PÁGINAS
// ============================================

const DOC_CONTENT = {
  'inicio': {
    title: 'VANTCALL Esports — Plataforma competitiva',
    isHome: true,
    content: `
      <section class="valorant-hero">
        <div class="hero-media" aria-hidden="true"></div>
        <div class="hero-grid" aria-hidden="true"></div>
        <div class="hero-badge"><span class="live-dot"></span> BETA ABIERTA · VALORANT · CS2 · LOL</div>
        <h1>VANT<span class="hero-accent">CALL</span></h1>
        <p class="hero-tagline">Ranked, torneos y eventos con datos reales. Entra con Discord, Google, Steam o tu correo y compite en la plataforma.</p>
        <div class="hero-cta">
          <a href="#/login" class="btn btn-primary btn-lg" data-auth-cta>JUGAR GRATIS</a>
          <a href="#/torneos" class="btn btn-secondary btn-lg">VER TORNEOS</a>
        </div>
        <div class="hero-meta" aria-label="Lo que incluye VANTS">
          <span>Ranked VANTS</span><span>Torneos y ligas</span><span>Bot de Discord</span><span>Pagos con Stripe</span>
        </div>
        <span class="hero-scroll" aria-hidden="true"></span>
      </section>

      <div class="marquee" aria-hidden="true">
        <div class="marquee-track">
          ${Array(2).fill(['VALORANT', 'Counter-Strike 2', 'League of Legends', 'Ranked VANTS', 'Torneos', 'Ligas', 'Scrims']).flat().map((t) => `<span class="marquee-item">${t}</span>`).join('')}
        </div>
      </div>

      <div class="stats-strip" data-async="home-stats">${skeleton(1)}</div>

      <section class="valorant-section home-grid-section">
        <div class="home-grid">
          <div>
            <div class="section-head"><h2>PRÓXIMOS TORNEOS</h2><a href="#/torneos">Ver todos</a></div>
            <div data-async="home-tournaments">${skeleton(3)}</div>
          </div>
          <div>
            <div class="section-head"><h2>TOP RANKED</h2><a href="#/ranked">Leaderboard</a></div>
            <div class="rankings-list" data-async="home-leaderboard">${skeleton(5)}</div>
          </div>
        </div>
      </section>

      <section class="valorant-section">
        <div class="section-header"><h2>RANGO VANTS</h2></div>
        <p class="section-lead">Ocho niveles, un recorrido por juego. Ganas VP por victoria, MVP y clutches; cada temporada conservas el 30% del VP acumulado.</p>
        ${RANKS_STRIP}
      </section>

      <section class="valorant-banner">
        <div class="banner-content">
          <h2>ÚNETE AL DISCORD</h2>
          <p>Avisos oficiales, salas de VALORANT y CS2, postulaciones y el bot de VANTCALL sincronizado con la web.</p>
          <a href="${DISCORD_INVITE}" target="_blank" rel="noopener noreferrer" class="btn btn-primary btn-lg">ENTRAR AL SERVIDOR</a>
        </div>
      </section>

      <!-- Pricing Preview -->
      <section class="valorant-section valorant-pricing">
        <div class="section-header">
          <h2>PLANES</h2>
        </div>
        <div class="pricing-grid">
          <div class="pricing-card pricing-tier-1">
            <div class="pricing-tier-tag">T1 · DISPONIBLE</div>
            <h3 class="pricing-tier-name">VANT BASIC</h3>
            <p class="pricing-desc">Acceso comunitario, 1 entrada a torneos abiertos y perfil Ranked.</p>
            <div class="pricing-price-line">
              <span class="pricing-price-num">€9</span>
              <span class="pricing-price-type">PAGO ÚNICO</span>
            </div>
            <ul class="pricing-features">
              <li>Ticket BASIC de por vida en esta temporada</li>
              <li>Inscripción a VANT Open</li>
              <li>Perfil Ranked (Bronze-Gold)</li>
              <li>Soporte estándar</li>
            </ul>
            <a href="#/checkout/basic" class="btn btn-secondary pricing-btn">COMPRAR</a>
          </div>
          <div class="pricing-card pricing-tier-2 pricing-featured">
            <div class="pricing-badge">MÁS POPULAR</div>
            <div class="pricing-tier-tag">T2 · DISPONIBLE</div>
            <h3 class="pricing-tier-name">VANT PRO</h3>
            <p class="pricing-desc">Ranked completo, Pro Series y prioridad de tryouts.</p>
            <div class="pricing-price-line">
              <span class="pricing-price-num">€19</span>
              <span class="pricing-price-type">PAGO ÚNICO</span>
            </div>
            <ul class="pricing-features">
              <li>Todo BASIC</li>
              <li>VANT Pro Series</li>
              <li>Sala privada / scrims</li>
              <li>Prioridad en tryouts</li>
              <li>Rol Operator equivalente</li>
            </ul>
            <a href="#/checkout/pro" class="btn btn-primary pricing-btn">COMPRAR</a>
          </div>
          <div class="pricing-card pricing-tier-3 pricing-elite">
            <div class="pricing-badge pricing-badge-elite">ELITE</div>
            <div class="pricing-tier-tag">T3 · DISPONIBLE</div>
            <h3 class="pricing-tier-name">VANT ELITE</h3>
            <p class="pricing-desc">Elite Invitational, cupo Command y marca visible en Ranked.</p>
            <div class="pricing-price-line">
              <span class="pricing-price-num">€39</span>
              <span class="pricing-price-type">PAGO ÚNICO</span>
            </div>
            <ul class="pricing-features">
              <li>Todo PRO</li>
              <li>VANT Elite Invitational</li>
              <li>Badge Elite en perfil</li>
              <li>Canal Command</li>
              <li>Revisión de verificación prioritaria</li>
            </ul>
            <a href="#/checkout/elite" class="btn btn-secondary pricing-btn">COMPRAR</a>
          </div>
        </div>
        <p class="pricing-note" style="text-align:center; margin-top: var(--space-6);">El pago se confirma por webhook de Stripe, no por el redirect del navegador. PayPal aparece en Checkout si está activo en tu cuenta Stripe.</p>
      </section>

      <!-- Login Methods -->
      <section class="valorant-section">
        <div class="section-header">
          <h2>INICIO DE SESIÓN</h2>
        </div>
        <div class="login-methods-home">
          <a href="#/login" class="login-method-card">
            <div class="login-method-icon discord-icon">
              <svg viewBox="0 0 24 24" fill="currentColor"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994.021-.041.001-.09-.041-.106a13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128c.126-.094.252-.192.372-.291a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.009c.12.099.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/></svg>
            </div>
            <h3>Discord</h3>
            <p>Acceso con cuenta de Discord vía OAuth 2.0</p>
          </a>
          <a href="#/login" class="login-method-card">
            <div class="login-method-icon google-icon">
              <svg viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>
            </div>
            <h3>Google</h3>
            <p>Entra con tu cuenta de Google en un clic</p>
          </a>
          <a href="#/login" class="login-method-card">
            <div class="login-method-icon steam-icon">
              <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M11.98 0C5.67 0 .5 4.86 0 11.04l6.44 2.66a3.4 3.4 0 0 1 1.92-.59l.19.01 2.86-4.15v-.06a4.53 4.53 0 1 1 4.53 4.53h-.1l-4.08 2.91.01.16a3.4 3.4 0 0 1-6.73.68L.43 15.33A12 12 0 1 0 11.98 0zM7.54 18.21l-1.47-.61a2.55 2.55 0 1 0 1.4-3.5l1.52.63a1.88 1.88 0 0 1-1.45 3.48zm11.42-9.3a3.02 3.02 0 1 0-6.04 0 3.02 3.02 0 0 0 6.04 0zm-5.28-.01a2.27 2.27 0 1 1 4.54 0 2.27 2.27 0 0 1-4.54 0z"/></svg>
            </div>
            <h3>Steam</h3>
            <p>Inicio con Steam verificado por OpenID</p>
          </a>
          <a href="#/registro" class="login-method-card">
            <div class="login-method-icon github-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>
            </div>
            <h3>Correo</h3>
            <p>Registro con correo y contraseña, verificación por email</p>
          </a>
        </div>
      </section>

    `,
    async load(main) {
      const DB = window.VantDB;
      const set = (k, html) => { const el = main.querySelector(`[data-async="${k}"]`); if (el) el.innerHTML = html; };
      DB.stats().then((s) => set('home-stats', `
        <div class="stat"><div class="stat-num">${s.players}</div><div class="stat-label">Jugadores registrados</div></div>
        <div class="stat"><div class="stat-num">${s.tournaments}</div><div class="stat-label">Torneos</div></div>
        <div class="stat"><div class="stat-num">${s.events}</div><div class="stat-label">Eventos próximos</div></div>
        <div class="stat"><div class="stat-num">${s.matches}</div><div class="stat-label">Partidas ranked</div></div>
        <div class="stat stat-live">${liveTag()}</div>`)).catch((e) => set('home-stats', errorState(e)));
      DB.tournaments().then((ts) => {
        const up = ts.filter((t) => !['completed', 'finished', 'cancelled', 'draft'].includes(t.status)).slice(0, 3);
        set('home-tournaments', up.length ? `<div class="t-grid t-grid-stack">${up.map(tournamentCard).join('')}</div>` : emptyState('Sin torneos abiertos', 'Aún no hay torneos publicados. Los anunciamos primero en Discord.', `<a class="btn btn-secondary" href="${DISCORD_INVITE}" target="_blank" rel="noopener noreferrer">Avisarme en Discord</a>`));
      }).catch((e) => set('home-tournaments', errorState(e)));
      DB.activeSeason().then(async (s) => {
        const rows = s ? await DB.leaderboard(s.id, 5) : [];
        set('home-leaderboard', rows.length ? leaderboardRows(rows) : emptyState('Leaderboard vacío', s ? 'Juega tus partidas de placement para aparecer aquí.' : 'La primera temporada ranked aún no ha comenzado.', '<a class="btn btn-secondary" href="#/ranked">Cómo funciona</a>'));
      }).catch((e) => set('home-leaderboard', errorState(e)));
    },
  },

  'calendario': {
    title: 'Calendario — VANTCALL Esports',
    content: `
      <h1>Calendario</h1>
      <p class="breadcrumb"><a href="#/inicio">VANTCALL</a> <span>/</span> Calendario ${liveTag()}</p>
      <div class="cal-toolbar">
        <div class="cal-nav">
          <button type="button" class="cal-nav-btn" data-cal-prev aria-label="Mes anterior"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M15 18l-6-6 6-6"/></svg></button>
          <h2 class="cal-month" data-cal-title aria-live="polite">—</h2>
          <button type="button" class="cal-nav-btn" data-cal-next aria-label="Mes siguiente"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M9 18l6-6-6-6"/></svg></button>
          <button type="button" class="btn btn-secondary btn-sm" data-cal-today>Hoy</button>
        </div>
        <div class="calendar-filters" role="tablist" aria-label="Filtrar calendario">
          <button type="button" class="calendar-filter active" data-filter="all" role="tab" aria-selected="true">TODO</button>
          <button type="button" class="calendar-filter" data-filter="match" role="tab" aria-selected="false"><span class="cal-dot cal-dot-match"></span>PARTIDAS</button>
          <button type="button" class="calendar-filter" data-filter="event" role="tab" aria-selected="false"><span class="cal-dot cal-dot-event"></span>EVENTOS</button>
          <button type="button" class="calendar-filter" data-filter="tournament" role="tab" aria-selected="false"><span class="cal-dot cal-dot-tournament"></span>TORNEOS</button>
        </div>
      </div>
      <div class="auth-msg" data-page-msg role="status" aria-live="polite" hidden></div>
      <div class="cal-layout">
        <div class="cal-grid-wrap" data-cal-grid>${skeleton(5)}</div>
        <div class="cal-agenda">
          <div class="cal-agenda-head"><h3 data-cal-agenda-title>Próximos</h3><button type="button" class="link-btn" data-cal-clear hidden>Ver todo el mes</button></div>
          <div data-async="calendar">${skeleton(4)}</div>
        </div>
      </div>
      <p class="login-note cal-tz">Horas mostradas en tu zona horaria (${esc(Intl.DateTimeFormat().resolvedOptions().timeZone || 'local')}).</p>`,
    async load(main) {
      const DB = window.VantDB;
      const box = main.querySelector('[data-async="calendar"]');
      const grid = main.querySelector('[data-cal-grid]');
      const titleEl = main.querySelector('[data-cal-title]');
      const agendaTitle = main.querySelector('[data-cal-agenda-title]');
      const clearBtn = main.querySelector('[data-cal-clear]');
      const tournamentRow = (t) => `<div class="match-card cal-tournament"><div class="match-time">${fmtTime(t.starts_at)}</div><div class="event-body"><div class="event-title">Inicio: ${esc(t.name)}</div><div class="event-sub">${esc(statusLabel(t.format) || 'Torneo')}${t.max_participants ? ` · ${t.current_participants || 0}/${t.max_participants} plazas` : ''}</div></div><div class="match-format">${statusPill(t.status)}<a class="btn btn-secondary btn-sm" href="#/torneo/${encodeURIComponent(t.slug)}">Ver</a></div></div>`;
      let items = [];
      try {
        const [matches, events, tournaments] = await Promise.all([DB.scheduledMatches(), DB.events(), DB.tournaments()]);
        items = [
          ...matches.filter((m) => m.scheduled_at).map((m) => ({ kind: 'match', at: m.scheduled_at, label: `${(m.p1 && (m.p1.display_name || m.p1.username)) || 'TBD'} vs ${(m.p2 && (m.p2.display_name || m.p2.username)) || 'TBD'}`, html: matchRow(m) })),
          ...events.filter((e) => e.starts_at && e.status !== 'cancelled').map((e) => ({ kind: 'event', at: e.starts_at, label: e.title, html: eventRow(e) })),
          ...tournaments.filter((t) => t.starts_at && t.status !== 'draft').map((t) => ({ kind: 'tournament', at: t.starts_at, label: t.name, html: tournamentRow(t) })),
        ].sort((a, b) => new Date(a.at) - new Date(b.at));
      } catch (e) { grid.innerHTML = ''; box.innerHTML = errorState(e); return; }

      const now = new Date();
      // Arranca en el mes del próximo elemento si el actual está vacío
      const nextUp = items.find((i) => new Date(i.at) >= new Date(now.getFullYear(), now.getMonth(), now.getDate()));
      let view = nextUp ? new Date(new Date(nextUp.at).getFullYear(), new Date(nextUp.at).getMonth(), 1) : new Date(now.getFullYear(), now.getMonth(), 1);
      if (!items.some((i) => { const d = new Date(i.at); return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth(); }) && !nextUp) view = new Date(now.getFullYear(), now.getMonth(), 1);
      let filter = 'all';
      let selectedDay = null;
      const todayKey = localDayKey(now);
      const MONTH = (d) => { const t = d.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' }); return t.charAt(0).toUpperCase() + t.slice(1); };

      const visible = () => items.filter((i) => filter === 'all' || i.kind === filter);
      const renderGrid = () => {
        titleEl.textContent = MONTH(view);
        const first = new Date(view.getFullYear(), view.getMonth(), 1);
        const offset = (first.getDay() + 6) % 7; // semana empieza en lunes
        const days = new Date(view.getFullYear(), view.getMonth() + 1, 0).getDate();
        const byDay = new Map();
        for (const i of visible()) { const k = localDayKey(i.at); if (!byDay.has(k)) byDay.set(k, []); byDay.get(k).push(i); }
        const cells = [];
        for (let i = 0; i < offset; i++) cells.push('<div class="cal-cell is-pad" aria-hidden="true"></div>');
        for (let d = 1; d <= days; d++) {
          const k = localDayKey(new Date(view.getFullYear(), view.getMonth(), d));
          const list = byDay.get(k) || [];
          const kinds = [...new Set(list.map((x) => x.kind))];
          cells.push(`<button type="button" class="cal-cell${k === todayKey ? ' is-today' : ''}${list.length ? ' has-items' : ''}${selectedDay === k ? ' is-selected' : ''}${k < todayKey ? ' is-past' : ''}" data-day="${k}" ${list.length ? '' : 'tabindex="-1"'} aria-label="${d} ${esc(MONTH(view))}: ${list.length ? list.length + ' elementos' : 'sin elementos'}">
            <span class="cal-num">${d}</span>
            ${list.length ? `<span class="cal-items">${list.slice(0, 2).map((x) => `<span class="cal-chip cal-chip-${x.kind}">${esc(x.label)}</span>`).join('')}${list.length > 2 ? `<span class="cal-more">+${list.length - 2}</span>` : ''}</span><span class="cal-dots">${kinds.map((x) => `<span class="cal-dot cal-dot-${x}"></span>`).join('')}</span>` : ''}
          </button>`);
        }
        grid.innerHTML = `<div class="cal-weekdays">${['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map((w) => `<span>${w}</span>`).join('')}</div><div class="cal-grid">${cells.join('')}</div>`;
        grid.querySelectorAll('.cal-cell.has-items').forEach((c) => c.addEventListener('click', () => { selectedDay = selectedDay === c.dataset.day ? null : c.dataset.day; render(); }));
      };
      const renderAgenda = () => {
        let list = visible();
        if (selectedDay) {
          list = list.filter((i) => localDayKey(i.at) === selectedDay);
          agendaTitle.textContent = fmtDay(selectedDay + 'T12:00:00');
        } else {
          list = list.filter((i) => { const d = new Date(i.at); return d.getFullYear() === view.getFullYear() && d.getMonth() === view.getMonth(); });
          agendaTitle.textContent = 'Agenda de ' + view.toLocaleDateString('es-ES', { month: 'long' });
          agendaTitle.style.textTransform = 'none';
        }
        clearBtn.hidden = !selectedDay;
        if (!list.length) {
          const upcoming = visible().filter((i) => new Date(i.at) >= now);
          box.innerHTML = emptyState(items.length ? 'Nada en estas fechas' : 'Calendario vacío', items.length ? (upcoming.length ? `Lo siguiente es el ${fmtDay(upcoming[0].at)}.` : 'No hay nada programado más adelante.') : 'Cuando el staff publique torneos y eventos (desde la web o con /vants en Discord) aparecerán aquí.', items.length && upcoming.length ? '<button type="button" class="btn btn-secondary btn-sm" data-cal-jump>Ir a lo siguiente</button>' : `<a class="btn btn-secondary btn-sm" href="${DISCORD_INVITE}" target="_blank" rel="noopener noreferrer">Seguir en Discord</a>`);
          const jump = box.querySelector('[data-cal-jump]');
          if (jump) jump.addEventListener('click', () => { const d = new Date(upcoming[0].at); view = new Date(d.getFullYear(), d.getMonth(), 1); selectedDay = localDayKey(d); render(); });
          return;
        }
        box.innerHTML = groupByDay(list, 'at').map(([k, arr]) => `
          <div class="match-day"><div class="match-day-header"><span class="match-day-date">${fmtDay(arr[0].at)}</span>${k === todayKey ? '<span class="match-day-badge">HOY</span>' : k < todayKey ? '<span class="match-day-badge is-past">PASADO</span>' : ''}</div>
          ${arr.map((i) => i.html).join('')}</div>`).join('');
        bindRsvp(main);
      };
      const render = () => { renderGrid(); renderAgenda(); };
      main.querySelector('[data-cal-prev]').addEventListener('click', () => { view = new Date(view.getFullYear(), view.getMonth() - 1, 1); selectedDay = null; render(); });
      main.querySelector('[data-cal-next]').addEventListener('click', () => { view = new Date(view.getFullYear(), view.getMonth() + 1, 1); selectedDay = null; render(); });
      main.querySelector('[data-cal-today]').addEventListener('click', () => { view = new Date(now.getFullYear(), now.getMonth(), 1); selectedDay = items.some((i) => localDayKey(i.at) === todayKey) ? todayKey : null; render(); });
      clearBtn.addEventListener('click', () => { selectedDay = null; render(); });
      main.querySelectorAll('.calendar-filter').forEach((b) => b.addEventListener('click', () => {
        main.querySelectorAll('.calendar-filter').forEach((x) => { x.classList.remove('active'); x.setAttribute('aria-selected', 'false'); });
        b.classList.add('active'); b.setAttribute('aria-selected', 'true'); filter = b.dataset.filter; render();
      }));
      render();
    },
  },

  'ranked': {
    title: 'Ranked — VANTCALL Esports',
    content: `
      <h1>Ranked</h1>
      <p class="breadcrumb"><a href="#/inicio">VANTCALL</a> <span>/</span> Ranked ${liveTag()}</p>
      <div class="dash-grid" data-async="ranked-season">${skeleton(1)}</div>
      <h2>Rango VANTS</h2>
      ${RANKS_STRIP}
      <h2>Leaderboard</h2>
      <div class="rankings-list rankings-full" data-async="ranked-lb">${skeleton(6)}</div>
      <h2>Reglas vigentes</h2>
      <div data-async="ranked-rules">${skeleton(2)}</div>
      <div class="bot-panel">
        <h3>Comandos del bot en Discord</h3>
        <div class="bot-commands">
          <div class="bot-cmd"><code>/perfil</code><span class="desc">Tu rango, MMR y plan</span></div>
          <div class="bot-cmd"><code>/ranking</code><span class="desc">Top 10 de la temporada</span></div>
          <div class="bot-cmd"><code>/torneos</code><span class="desc">Torneos abiertos</span></div>
          <div class="bot-cmd"><code>/torneo inscribir</code><span class="desc">Inscribirte en un torneo</span></div>
          <div class="bot-cmd"><code>/calendario</code><span class="desc">Próximos 7 días</span></div>
          <div class="bot-cmd"><code>/vincular</code><span class="desc">Conectar Discord con la web</span></div>
        </div>
        <p class="login-note">Entra con Discord en la web para que el bot reconozca tu perfil. Los resultados y anuncios se publican automáticamente en los canales del servidor.</p>
      </div>`,
    async load(main) {
      const DB = window.VantDB;
      const set = (k, h) => { const el = main.querySelector(`[data-async="${k}"]`); if (el) el.innerHTML = h; };
      const RULE_LABEL = { placement_matches: 'Partidas de placement', mmr_per_win: 'MMR por victoria', mmr_per_loss: 'MMR por derrota', queue_timeout: 'Tiempo máximo en cola (s)', min_players_per_match: 'Jugadores mínimos por partida' };
      DB.rules().then((rs) => set('ranked-rules', rs.length ? `<div class="rules-grid">${rs.map((r) => `<div class="rule"><div class="rule-val">${esc(r.rule_value)}</div><div class="rule-key">${esc(RULE_LABEL[r.rule_key] || r.description || r.rule_key)}</div></div>`).join('')}</div>` : emptyState('Sin reglas', 'Las reglas se publicarán al abrir la temporada.'))).catch((e) => set('ranked-rules', errorState(e)));
      try {
        const s = await DB.activeSeason();
        set('ranked-season', s ? `
          <div class="dash-card"><div class="label">Temporada</div><div class="value">${esc(s.name || 'T' + s.season_number)}</div><div class="sub">${statusPill(s.status)}</div></div>
          <div class="dash-card"><div class="label">Inicio</div><div class="value">${fmtDate(s.start_date, { day: 'numeric', month: 'short' })}</div><div class="sub">${fmtDate(s.start_date)}</div></div>
          <div class="dash-card"><div class="label">Fin</div><div class="value">${fmtDate(s.end_date, { day: 'numeric', month: 'short' })}</div><div class="sub">${fmtDate(s.end_date)}</div></div>`
          : `<div class="dash-card dash-card-wide"><div class="label">Temporada</div><div class="value">Próximamente</div><div class="sub">La temporada 1 se anunciará en Discord.</div></div>`);
        const rows = s ? await DB.leaderboard(s.id, 50) : [];
        set('ranked-lb', rows.length ? leaderboardRows(rows) : emptyState('Aún no hay jugadores clasificados', 'Completa las partidas de placement desde el bot de Discord para entrar en el leaderboard.', `<a class="btn btn-secondary" href="${DISCORD_INVITE}" target="_blank" rel="noopener noreferrer">Abrir Discord</a>`));
      } catch (e) { set('ranked-season', errorState(e)); set('ranked-lb', ''); }
    },
  },

  'torneos': {
    title: 'Torneos — VANTCALL Esports',
    content: `
      <h1>Torneos</h1>
      <p class="breadcrumb"><a href="#/inicio">VANTCALL</a> <span>/</span> Torneos ${liveTag()}</p>
      <div data-async="tournaments">${skeleton(4)}</div>`,
    async load(main) {
      const box = main.querySelector('[data-async="tournaments"]');
      try {
        const ts = await window.VantDB.tournaments();
        if (!ts.length) { box.innerHTML = emptyState('Todavía no hay torneos', 'Los organizadores publicarán aquí los torneos de VALORANT, CS2 y LoL. Inscríbete desde la web o con /torneo inscribir en Discord.', `<a class="btn btn-primary" href="${DISCORD_INVITE}" target="_blank" rel="noopener noreferrer">Seguir en Discord</a>`); return; }
        const open = ts.filter((t) => ['registration', 'open', 'upcoming', 'in_progress', 'live', 'active'].includes(t.status));
        const past = ts.filter((t) => ['completed', 'finished', 'cancelled', 'closed'].includes(t.status));
        const other = ts.filter((t) => !open.includes(t) && !past.includes(t));
        const sec = (title, arr) => arr.length ? `<h2>${title}</h2><div class="t-grid">${arr.map(tournamentCard).join('')}</div>` : '';
        box.innerHTML = sec('Abiertos y en curso', open) + sec('Próximamente', other) + sec('Finalizados', past);
      } catch (e) { box.innerHTML = errorState(e); }
    },
  },

  'jugadores': {
    title: 'Jugadores — VANTCALL Esports',
    content: `
      <h1>Jugadores</h1>
      <p class="breadcrumb"><a href="#/inicio">VANTCALL</a> <span>/</span> Jugadores ${liveTag()}</p>
      <form class="search-bar" data-player-search role="search">
        <input class="login-form-input" name="q" type="search" placeholder="Buscar por nombre de jugador" aria-label="Buscar jugador" autocomplete="off">
        <button class="btn btn-primary" type="submit">Buscar</button>
      </form>
      <div data-async="players">${skeleton(6)}</div>`,
    async load(main) {
      const box = main.querySelector('[data-async="players"]');
      const run = async (qs) => {
        box.innerHTML = skeleton(6);
        try {
          const ps = await window.VantDB.players(qs);
          box.innerHTML = ps.length ? `<div class="player-grid">${ps.map((p) => `
            <a class="player-card" href="#/jugador/${encodeURIComponent(p.username)}">
              <div class="player-avatar">${p.avatar_url ? `<img src="${esc(p.avatar_url)}" alt="" loading="lazy">` : initials(p.username)}</div>
              <div class="player-info"><div class="player-name">${esc(p.display_name || p.username)}${p.verified ? ' <span class="verified" title="Verificado">✓</span>' : ''}</div>
              <div class="player-sub">@${esc(p.username)}${p.region ? ' · ' + esc(p.region) : ''}${p.main_game ? ' · ' + esc(GAMES[p.main_game] || p.main_game) : ''}</div></div>
            </a>`).join('')}</div>`
            : emptyState(qs ? 'Sin resultados' : 'Aún no hay jugadores', qs ? 'Prueba con otro nombre.' : 'Sé el primero: crea tu cuenta con Discord, Google, Steam o correo.', qs ? '' : '<a class="btn btn-primary" href="#/registro">Crear cuenta</a>');
        } catch (e) { box.innerHTML = errorState(e); }
      };
      main.querySelector('[data-player-search]').addEventListener('submit', (e) => { e.preventDefault(); run(e.target.q.value.trim()); });
      run('');
    },
  },

  // ---- PRECIOS (Enhanced Monetization) ----
  'precios': {
    title: 'Planes y Precios — VANTCALL Esports',
    group: 'Plataforma',
    content: `
      <div class="pricing-header-block">
        <div class="pricing-tag">TICKETS · MONETIZACIÓN</div>
        <h1>VANT BASIC · PRO · ELITE</h1>
        <p class="pricing-note">El pago se confirma por webhook de Stripe, no por el redirect del navegador. PayPal aparece en Checkout si está activo en tu cuenta Stripe.</p>
        <p class="pricing-note-dim">Precios con IVA incluido. Necesitas iniciar sesión para comprar: el plan se asigna a tu cuenta automáticamente.</p>
      </div>

      <div class="pricing-grid">
        <div class="pricing-card pricing-tier-1">
          <div class="pricing-tier-tag">T1 · DISPONIBLE</div>
          <h3 class="pricing-tier-name">VANT BASIC</h3>
          <p class="pricing-desc">Acceso comunitario, 1 entrada a torneos abiertos y perfil Ranked.</p>
          <div class="pricing-price-line">
            <span class="pricing-price-num">€9</span>
            <span class="pricing-price-type">PAGO ÚNICO</span>
          </div>
          <ul class="pricing-features">
            <li>Ticket BASIC de por vida en esta temporada</li>
            <li>Inscripción a VANT Open</li>
            <li>Perfil Ranked (Bronze-Gold)</li>
            <li>Soporte estándar</li>
          </ul>
          <a href="#/checkout/basic" class="btn btn-secondary pricing-btn">COMPRAR</a>
        </div>

        <div class="pricing-card pricing-tier-2 pricing-featured">
          <div class="pricing-badge">MÁS POPULAR</div>
          <div class="pricing-tier-tag">T2 · DISPONIBLE</div>
          <h3 class="pricing-tier-name">VANT PRO</h3>
          <p class="pricing-desc">Ranked completo, Pro Series y prioridad de tryouts.</p>
          <div class="pricing-price-line">
            <span class="pricing-price-num">€19</span>
            <span class="pricing-price-type">PAGO ÚNICO</span>
          </div>
          <ul class="pricing-features">
            <li>Todo BASIC</li>
            <li>VANT Pro Series</li>
            <li>Sala privada / scrims</li>
            <li>Prioridad en tryouts</li>
            <li>Rol Operator equivalente</li>
          </ul>
          <a href="#/checkout/pro" class="btn btn-primary pricing-btn">COMPRAR</a>
        </div>

        <div class="pricing-card pricing-tier-3 pricing-elite">
          <div class="pricing-badge pricing-badge-elite">ELITE</div>
          <div class="pricing-tier-tag">T3 · DISPONIBLE</div>
          <h3 class="pricing-tier-name">VANT ELITE</h3>
          <p class="pricing-desc">Elite Invitational, cupo Command y marca visible en Ranked.</p>
          <div class="pricing-price-line">
            <span class="pricing-price-num">€39</span>
            <span class="pricing-price-type">PAGO ÚNICO</span>
          </div>
          <ul class="pricing-features">
            <li>Todo PRO</li>
            <li>VANT Elite Invitational</li>
            <li>Badge Elite en perfil</li>
            <li>Canal Command</li>
            <li>Revisión de verificación prioritaria</li>
          </ul>
          <a href="#/checkout/elite" class="btn btn-secondary pricing-btn">COMPRAR</a>
        </div>
      </div>

      <h2 style="margin-top: var(--space-20);">COMPARATIVA DE PLANES</h2>

      <div class="pricing-comparison">
        <table>
          <thead>
            <tr>
              <th>Característica</th>
              <th>BASIC</th>
              <th>PRO</th>
              <th>ELITE</th>
            </tr>
          </thead>
          <tbody>
            <tr><td>Perfil Ranked</td><td class="check">✓</td><td class="check">✓</td><td class="check">✓</td></tr>
            <tr><td>VANT Open</td><td class="check">✓</td><td class="check">✓</td><td class="check">✓</td></tr>
            <tr><td>VANT Pro Series</td><td class="cross">—</td><td class="check">✓</td><td class="check">✓</td></tr>
            <tr><td>Elite Invitational</td><td class="cross">—</td><td class="cross">—</td><td class="check">✓</td></tr>
            <tr><td>Sala privada / scrims</td><td class="cross">—</td><td class="check">✓</td><td class="check">✓</td></tr>
            <tr><td>Prioridad en tryouts</td><td class="cross">—</td><td class="check">✓</td><td class="check">✓</td></tr>
            <tr><td>Badge Elite en perfil</td><td class="cross">—</td><td class="cross">—</td><td class="check">✓</td></tr>
            <tr><td>Canal Command</td><td class="cross">—</td><td class="cross">—</td><td class="check">✓</td></tr>
            <tr><td>Soporte prioritario</td><td class="cross">—</td><td class="check">✓</td><td class="check">✓</td></tr>
            <tr><td>Verificación prioritaria</td><td class="cross">—</td><td class="cross">—</td><td class="check">✓</td></tr>
          </tbody>
        </table>
      </div>

      <p class="pricing-footer-note">Pagos procesados por Stripe. ¿Dudas con tu compra? Escribe a <a href="mailto:feispla@hotmail.com" class="pricing-link">feispla@hotmail.com</a></p>
    `
  },

};

// ---- rutas dinámicas ----
function tournamentPage(slug) {
  return {
    title: 'Torneo — VANTCALL Esports',
    content: `<p class="breadcrumb"><a href="#/torneos">Torneos</a> <span>/</span> <span data-crumb>…</span></p><div data-async="t">${skeleton(5)}</div>`,
    async load(main) {
      const box = main.querySelector('[data-async="t"]');
      try {
        const t = await window.VantDB.tournament(slug);
        if (!t) { box.innerHTML = emptyState('Torneo no encontrado', 'Puede que el enlace sea antiguo.', '<a class="btn btn-secondary" href="#/torneos">Ver torneos</a>'); return; }
        document.title = t.name + ' — VANTCALL Esports';
        main.querySelector('[data-crumb]').textContent = t.name;
        const rounds = {};
        for (const m of t.matches) (rounds[m.round || 1] = rounds[m.round || 1] || []).push(m);
        const canRegister = ['registration', 'open', 'upcoming'].includes(t.status);
        box.innerHTML = `
          <div class="t-hero">
            <div>${statusPill(t.status)}${t.tier ? `<span class="t-tier">${esc(String(t.tier).toUpperCase())}</span>` : ''}</div>
            <h1>${esc(t.name)}</h1>
            <p>${esc(t.description || '')}</p>
            <div class="auth-msg" data-page-msg role="status" aria-live="polite" hidden></div>
            ${canRegister ? `<div class="t-actions"><button type="button" class="btn btn-primary" data-register="${esc(t.id)}">Inscribirme</button><button type="button" class="btn btn-secondary" data-unregister="${esc(t.id)}" hidden>Cancelar inscripción</button></div>` : ''}
          </div>
          <div class="dash-grid">
            <div class="dash-card"><div class="label">Formato</div><div class="value value-sm">${esc(statusLabel(t.format))}</div></div>
            <div class="dash-card"><div class="label">Participantes</div><div class="value">${t.entries.length}${t.max_participants ? ' / ' + t.max_participants : ''}</div></div>
            <div class="dash-card"><div class="label">Inicio</div><div class="value value-sm">${fmtDate(t.starts_at)}</div><div class="sub">${fmtTime(t.starts_at)}</div></div>
            <div class="dash-card"><div class="label">Premio</div><div class="value value-sm">${esc(t.prize_pool || '—')}</div></div>
          </div>
          ${t.registration_closes_at ? `<p class="login-note" style="text-align:left">Inscripción hasta el ${fmtDate(t.registration_closes_at)} a las ${fmtTime(t.registration_closes_at)}.</p>` : ''}
          <h2>Bracket</h2>
          ${Object.keys(rounds).length ? `<div class="bracket">${Object.entries(rounds).map(([r, ms]) => `<div class="bracket-round"><div class="bracket-title">Ronda ${esc(r)}</div>${ms.map(matchRow).join('')}</div>`).join('')}</div>` : emptyState('Bracket pendiente', 'El bracket se genera cuando se cierra la inscripción.')}
          <h2>Inscritos</h2>
          ${t.entries.length ? `<div class="player-grid">${t.entries.map((e) => e.player ? `<a class="player-card" href="#/jugador/${encodeURIComponent(e.player.username)}"><div class="player-avatar">${e.player.avatar_url ? `<img src="${esc(e.player.avatar_url)}" alt="" loading="lazy">` : initials(e.player.username)}</div><div class="player-info"><div class="player-name">${e.seed ? '#' + e.seed + ' ' : ''}${esc(e.player.display_name || e.player.username)}</div><div class="player-sub">${esc(statusLabel(e.status))}</div></div></a>` : '').join('')}</div>` : emptyState('Nadie inscrito aún', 'Sé el primero en inscribirte.')}
          ${t.rules ? `<h2>Reglas</h2><div class="rules-text">${esc(t.rules).replace(/\n/g, '<br>')}</div>` : ''}`;
        if (window.VantAuth) window.VantAuth.bindTournament(main, t);
      } catch (e) { box.innerHTML = errorState(e); }
    },
  };
}

function playerPage(username) {
  return {
    title: 'Jugador — VANTCALL Esports',
    content: `<p class="breadcrumb"><a href="#/jugadores">Jugadores</a> <span>/</span> @${esc(username)}</p><div data-async="p">${skeleton(5)}</div>`,
    async load(main) {
      const box = main.querySelector('[data-async="p"]');
      try {
        const p = await window.VantDB.player(username);
        if (!p) { box.innerHTML = emptyState('Jugador no encontrado', 'Revisa el nombre de usuario.', '<a class="btn btn-secondary" href="#/jugadores">Ver jugadores</a>'); return; }
        document.title = (p.display_name || p.username) + ' — VANTCALL Esports';
        const cur = p.stats.find((s) => s.season && s.season.status === 'active') || p.stats[0];
        const total = p.stats.reduce((a, s) => ({ w: a.w + (s.wins || 0), l: a.l + (s.losses || 0) }), { w: 0, l: 0 });
        const wr = total.w + total.l ? Math.round((total.w / (total.w + total.l)) * 100) : 0;
        box.innerHTML = `
          <div class="profile-head">
            <div class="player-avatar player-avatar-lg">${p.avatar_url ? `<img src="${esc(p.avatar_url)}" alt="">` : initials(p.username)}</div>
            <div>
              <h1>${esc(p.display_name || p.username)}${p.verified ? ' <span class="verified" title="Verificado">✓</span>' : ''}</h1>
              <div class="player-sub">@${esc(p.username)}${p.region ? ' · ' + esc(p.region) : ''}${p.main_game ? ' · ' + esc(GAMES[p.main_game] || p.main_game) : ''} · Desde ${fmtDate(p.created_at, { month: 'short', year: 'numeric' })}</div>
              ${cur ? `<div style="margin-top:var(--space-3)">${rankBadge(cur)}</div>` : ''}
            </div>
          </div>
          ${p.profile && p.profile.bio ? `<p class="profile-bio">${esc(p.profile.bio)}</p>` : ''}
          <div class="dash-grid">
            <div class="dash-card"><div class="label">MMR actual</div><div class="value">${cur ? cur.mmr : '—'}</div><div class="sub">${cur && cur.season ? esc(cur.season.name || 'Temporada ' + cur.season.season_number) : 'Sin temporada'}</div></div>
            <div class="dash-card"><div class="label">Victorias</div><div class="value">${total.w}</div></div>
            <div class="dash-card"><div class="label">Derrotas</div><div class="value">${total.l}</div></div>
            <div class="dash-card"><div class="label">Winrate</div><div class="value">${wr}%</div></div>
          </div>
          <h2>Historial ranked</h2>
          ${p.matches.length ? `<ul class="history-list">${p.matches.map((m) => {
            const isP1 = m.player1_id === p.id;
            const won = (m.result === 'player1_win' && isP1) || (m.result === 'player2_win' && !isP1);
            const delta = isP1 ? m.mmr_change_p1 : m.mmr_change_p2;
            const label = m.result === 'draw' ? 'Empate' : m.status !== 'completed' ? statusLabel(m.status) : won ? 'Victoria' : 'Derrota';
            return `<li class="${won ? 'win' : m.status === 'completed' && m.result !== 'draw' ? 'loss' : ''}"><span>${label}</span><span>${delta != null ? (delta > 0 ? '+' : '') + delta + ' MMR' : ''}</span><span>${fmtDate(m.completed_at || m.created_at)}</span></li>`;
          }).join('')}</ul>` : emptyState('Sin partidas', 'Este jugador aún no ha jugado ranked.')}
          <h2>Torneos</h2>
          ${p.entries.length ? `<ul class="history-list">${p.entries.map((e) => e.tournament ? `<li><a href="#/torneo/${encodeURIComponent(e.tournament.slug)}">${esc(e.tournament.name)}</a><span>${esc(statusLabel(e.status))}</span><span>${fmtDate(e.tournament.starts_at)}</span></li>` : '').join('')}</ul>` : emptyState('Sin torneos', 'Todavía no se ha inscrito en ningún torneo.')}`;
      } catch (e) { box.innerHTML = errorState(e); }
    },
  };
}

function bindRsvp(main) {
  main.querySelectorAll('[data-rsvp]').forEach((b) => {
    if (b.dataset.bound) return;
    b.dataset.bound = '1';
    b.addEventListener('click', () => window.VantAuth && window.VantAuth.rsvp(b.dataset.rsvp, b, main.querySelector('[data-page-msg]')));
  });
}

// ============================================
// ROUTER
// ============================================

function resolvePage(pageId) {
  if (DOC_CONTENT[pageId]) return DOC_CONTENT[pageId];
  const [head, ...rest] = pageId.split('/');
  const arg = decodeURIComponent(rest.join('/'));
  if (head === 'torneo' && arg) return tournamentPage(arg);
  if (head === 'jugador' && arg) return playerPage(arg);
  return null;
}

function renderPage(pageId) {
  const page = resolvePage(pageId);
  if (!page) { window.location.hash = '#/inicio'; return; }
  const main = document.getElementById('main');
  document.title = page.title;
  main.innerHTML = `
    <div class="content-wrapper${page.isHome ? ' content-wrapper-home' : ''}">
      <div class="content${page.isHome ? ' content-home' : ''}">${page.content}</div>
    </div>`;
  const section = pageId.split('/')[0];
  const navKey = section === 'torneo' ? 'torneos' : section === 'jugador' ? 'jugadores' : pageId;
  document.querySelectorAll('.nav-item, .mobile-nav-item').forEach((link) => {
    link.classList.toggle('active', link.getAttribute('href') === `#/${navKey}`);
  });
  const mobileNav = document.getElementById('mobile-nav');
  if (mobileNav) mobileNav.classList.remove('show');
  window.scrollTo(0, 0);
  if (typeof page.load === 'function') {
    if (!window.VantDB || !window.VantDB.client) {
      main.querySelectorAll('[data-async]').forEach((el) => { el.innerHTML = errorState(new Error('No se pudo cargar el cliente de Supabase.')); });
    } else {
      page.load(main);
    }
  }
  if (window.VantAuth) window.VantAuth.afterRender(pageId);
}

function router() {
  const hash = window.location.hash.replace('#/', '').split('?')[0];
  renderPage(hash || 'inicio');
}

function initTheme() {
  const toggle = document.querySelector('[data-theme-toggle]');
  const root = document.documentElement;
  let theme = 'dark';
  root.setAttribute('data-theme', theme);
  updateThemeIcon(toggle, theme);
  toggle && toggle.addEventListener('click', () => {
    theme = theme === 'dark' ? 'light' : 'dark';
    root.setAttribute('data-theme', theme);
    updateThemeIcon(toggle, theme);
  });
}

function updateThemeIcon(toggle, theme) {
  if (!toggle) return;
  toggle.setAttribute('aria-label', 'Cambiar a modo ' + (theme === 'dark' ? 'claro' : 'oscuro'));
  toggle.innerHTML = theme === 'dark'
    ? '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>'
    : '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';
}

function initMobileMenu() {
  const menuToggle = document.getElementById('menu-toggle');
  const mobileNav = document.getElementById('mobile-nav');
  if (!menuToggle || !mobileNav) return;
  menuToggle.addEventListener('click', () => mobileNav.classList.toggle('show'));
}

function init() {
  initTheme();
  initMobileMenu();
  router();
}

document.addEventListener('DOMContentLoaded', init);
window.addEventListener('hashchange', router);
