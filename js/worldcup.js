// === MUNDIAL (World Cup) ===
// Datos: openfootball/worldcup.json (dominio público, sin API key).
// Solo Mundiales de selecciones. Se excluye 2025 (Mundial de Clubes).
const WC_BASE = 'https://raw.githubusercontent.com/openfootball/worldcup.json/master';
const WC_YEARS = [2026, 2022, 2018, 2014, 2010, 2006, 2002, 1998, 1994, 1990, 1986, 1982, 1978, 1974, 1970, 1966, 1962, 1958, 1954, 1950, 1938, 1934, 1930];

let wcData = null;
let wcYear = 2026;
let currentWcSub = 'calendar';
let wcLoading = false;
let wcTeamFilter = '';

// --- Selector de año ---
(function initWcSelector() {
  const sel = $('wcYear');
  if (!sel) return;
  sel.innerHTML = WC_YEARS.map(y => `<option value="${y}">Mundial ${y}</option>`).join('');
  sel.value = String(wcYear);
  sel.addEventListener('change', () => { wcYear = Number(sel.value); wcData = null; loadWc(true); });
})();

document.querySelectorAll('.wc-sub-btn').forEach(btn => {
  btn.addEventListener('click', () => setWcSubview(btn.dataset.wcsub));
});
const wcRefreshBtn = $('wcRefreshBtn');
if (wcRefreshBtn) wcRefreshBtn.addEventListener('click', () => loadWc(true));
const wcTeamSel = $('wcTeam');
if (wcTeamSel) wcTeamSel.addEventListener('change', () => { wcTeamFilter = wcTeamSel.value; renderWcCalendar(); });

// --- Navegación de sub-pestañas (la llama goTo en core.js) ---
function setWcSubview(sub) {
  currentWcSub = sub;
  ['wcCalendarSubview', 'wcGroupsSubview'].forEach(v => hide(v));
  show(sub === 'groups' ? 'wcGroupsSubview' : 'wcCalendarSubview');
  document.querySelectorAll('.wc-sub-btn').forEach(b => {
    const active = b.dataset.wcsub === sub;
    b.classList.toggle('bg-sky-500', active);
    b.classList.toggle('text-white', active);
    b.classList.toggle('text-slate-400', !active);
  });
  if (!wcData) loadWc();
  else renderWc();
}
window.setWcSubview = setWcSubview;

// --- Carga de datos ---
async function loadWc(force) {
  if (wcLoading) return;
  wcLoading = true;
  const status = $('wcStatus');
  if (status) status.textContent = 'Cargando…';
  try {
    const url = `${WC_BASE}/${wcYear}/worldcup.json` + (force ? `?t=${Date.now()}` : '');
    const res = await fetch(url, { cache: force ? 'reload' : 'default' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    wcData = await res.json();
    if (status) status.textContent = 'Actualizado ' + new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  } catch (e) {
    wcData = null;
    if (status) status.textContent = 'No se pudo cargar. Reintenta.';
    const list = $('wcList');
    if (list) list.innerHTML = `
      <div class="bg-slate-900 rounded-2xl p-10 border border-slate-800 text-center">
        <p class="text-slate-400 text-sm">No se pudieron cargar los datos. Pulsa Refrescar para reintentar.</p>
      </div>`;
    wcLoading = false;
    return;
  }
  wcLoading = false;
  populateWcTeams();
  renderWc();
}

// Llena el selector con las selecciones reales de la edición (excluye placeholders tipo "W101").
function wcIsTeam(t) {
  return !!t && !/^\d/.test(t) && !/^[WL]\d+$/.test(t);
}
function populateWcTeams() {
  const sel = $('wcTeam');
  if (!sel || !wcData) return;
  const set = new Set();
  (wcData.matches || []).forEach(m => {
    [m.team1, m.team2].forEach(t => { if (wcIsTeam(t)) set.add(t); });
  });
  const teams = [...set].sort((a, b) => a.localeCompare(b, 'es'));
  const prev = wcTeamFilter;
  sel.innerHTML = `<option value="">Todas las selecciones</option>` +
    teams.map(t => `<option value="${escapeHtml(t)}">${escapeHtml(t)}</option>`).join('');
  if (prev && teams.includes(prev)) { sel.value = prev; }
  else { wcTeamFilter = ''; sel.value = ''; }
}

// --- Helpers ---
// Hora local de Copenhague cuando la fuente trae offset (ej. "13:00 UTC-6"); si no, hora tal cual.
function wcKickoff(date, time) {
  if (!date || !time) return null;
  const m = time.match(/^(\d{1,2}):(\d{2})\s*UTC([+-]\d{1,2})$/);
  if (!m) return null;
  const hh = m[1].padStart(2, '0');
  const n = Number(m[3]);
  const off = (n < 0 ? '-' : '+') + String(Math.abs(n)).padStart(2, '0') + ':00';
  const d = new Date(`${date}T${hh}:${m[2]}:00${off}`);
  return isNaN(d.getTime()) ? null : d;
}
function wcLocalTime(date, time) {
  const d = wcKickoff(date, time);
  if (d) return d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Copenhagen' });
  return (time || '').replace(/\s*UTC[+-]\d+/, '') || '—';
}
function wcDateLabel(dateStr) {
  const d = new Date(dateStr + 'T12:00:00');
  const s = d.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
  return s.charAt(0).toUpperCase() + s.slice(1);
}
function wcScore(m) {
  if (!m.score) return null;
  const main = m.score.et || m.score.ft;
  if (!main) return null;
  return `${main[0]}–${main[1]}${m.score.et ? ' pró.' : ''}`;
}
function wcPens(m) {
  return (m.score && m.score.p) ? `Penaltis ${m.score.p[0]}–${m.score.p[1]}` : null;
}

// --- Render principal ---
function renderWc() {
  if (!wcData) return;
  if (currentWcSub === 'groups') renderWcGroups();
  else renderWcCalendar();
}

function renderWcCalendar() {
  const list = $('wcList');
  if (!list) return;
  const all = (wcData.matches || []).slice()
    .sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || '')));
  const matches = wcTeamFilter
    ? all.filter(m => m.team1 === wcTeamFilter || m.team2 === wcTeamFilter)
    : all;
  if (!matches.length) {
    list.innerHTML = `<div class="bg-slate-900 rounded-2xl p-10 border border-slate-800 text-center"><p class="text-slate-400 text-sm">Sin partidos.</p></div>`;
    return;
  }
  let html = '';
  let lastDate = '';
  matches.forEach(m => {
    if (m.date !== lastDate) {
      lastDate = m.date;
      html += `<p class="text-xs uppercase tracking-widest text-slate-400 px-1 pt-2 pb-0.5">${wcDateLabel(m.date)}</p>`;
    }
    const score = wcScore(m);
    const pens = wcPens(m);
    const tag = m.group || m.round || '';
    const ground = m.ground || '';
    const right = score
      ? `<span class="font-mono text-lg text-sky-400">${score}</span>`
      : `<span class="font-mono text-sm text-slate-400">${wcLocalTime(m.date, m.time)}</span>`;
    html += `
      <div class="bg-slate-900 rounded-xl px-3 py-2 border border-slate-800">
        <div class="flex items-center justify-between gap-3">
          <div class="flex-1 min-w-0">
            <p class="text-white text-sm font-medium">${escapeHtml(m.team1 || '')} <span class="text-slate-500">vs</span> ${escapeHtml(m.team2 || '')}</p>
            <p class="text-slate-500 text-xs mt-0.5">${escapeHtml(tag)}${ground ? ' · ' + escapeHtml(ground) : ''}</p>
          </div>
          <div class="text-right shrink-0">${right}</div>
        </div>
        ${pens ? `<p class="text-[10px] text-amber-400 mt-1 text-right">${pens}</p>` : ''}
      </div>`;
  });
  list.innerHTML = html;
}

function renderWcGroups() {
  const wrap = $('wcGroups');
  if (!wrap) return;
  const groups = {};
  (wcData.matches || []).forEach(m => {
    if (!m.group) return;
    const g = groups[m.group] || (groups[m.group] = {});
    const a = g[m.team1] || (g[m.team1] = { team: m.team1, P: 0, W: 0, D: 0, L: 0, GF: 0, GA: 0, Pts: 0 });
    const b = g[m.team2] || (g[m.team2] = { team: m.team2, P: 0, W: 0, D: 0, L: 0, GF: 0, GA: 0, Pts: 0 });
    if (!m.score || !m.score.ft) return;
    const [x, y] = m.score.ft;
    a.P++; b.P++; a.GF += x; a.GA += y; b.GF += y; b.GA += x;
    if (x > y) { a.W++; a.Pts += 3; b.L++; }
    else if (x < y) { b.W++; b.Pts += 3; a.L++; }
    else { a.D++; b.D++; a.Pts++; b.Pts++; }
  });
  const names = Object.keys(groups).sort();
  if (!names.length) {
    wrap.innerHTML = `<div class="bg-slate-900 rounded-2xl p-10 border border-slate-800 text-center"><p class="text-slate-400 text-sm">Este Mundial no tiene fase de grupos.</p></div>`;
    return;
  }
  wrap.innerHTML = names.map(gName => {
    const rows = Object.values(groups[gName]).sort((p, q) =>
      q.Pts - p.Pts || (q.GF - q.GA) - (p.GF - p.GA) || q.GF - p.GF || p.team.localeCompare(q.team));
    const body = rows.map((r, i) => `
      <div class="flex items-center justify-between py-1.5 ${i < rows.length - 1 ? 'border-b border-slate-800' : ''}">
        <div class="flex items-center gap-2 min-w-0">
          <span class="font-mono text-xs text-slate-500 w-4">${i + 1}</span>
          <span class="text-white text-sm truncate">${escapeHtml(r.team)}</span>
        </div>
        <div class="flex items-center gap-3 shrink-0 text-xs">
          <span class="text-slate-500 font-mono">${r.P}j · ${r.GF}-${r.GA}</span>
          <span class="font-mono text-sky-400 font-medium w-6 text-right">${r.Pts}</span>
        </div>
      </div>`).join('');
    return `
      <div class="bg-slate-900 rounded-2xl p-4 border border-slate-800">
        <p class="text-xs uppercase tracking-widest text-slate-400 mb-2">${escapeHtml(gName)}</p>
        ${body}
      </div>`;
  }).join('');
}
