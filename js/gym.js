// === GIMNASIO (sesiones por día) ===
// Modelo: colección `sessions`, UN documento por día (id = 'YYYY-MM-DD'):
//   { date, bodyWeight, exercises:[{name,sets,reps,weight}], note, createdAt, updatedAt }
// Guardar la sesión del día = registrar asistencia. Racha y peso se derivan de aquí.

let currentGymSub = 'entreno';
let gymEditDate = todayStr();           // día que se está editando en "Entreno"
let gymCalMonth = startOfMonth(new Date()); // mes mostrado en el calendario
let editingExerciseIdx = null;          // índice del ejercicio en edición (null = nuevo)
let dayModalDate = null;                // fecha abierta en el modal de detalle

function todayStr() { return new Date().toISOString().split('T')[0]; }
function startOfMonth(d) { return new Date(d.getFullYear(), d.getMonth(), 1); }
function getSession(date) { return sessions.find(s => s.date === date) || null; }

function fmtDayLong(ds) {
  return new Date(ds + 'T00:00:00').toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}
function fmtDayShort(ds) {
  return new Date(ds + 'T00:00:00').toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' });
}

// Texto de detalle de un ejercicio: "4 series · 10 repes · 60 kg"
function exDetail(w) {
  const parts = [];
  if (w.sets) parts.push(`${w.sets} ${w.sets === 1 ? 'serie' : 'series'}`);
  if (w.reps) parts.push(`${w.reps} ${w.reps === 1 ? 'repe' : 'repes'}`);
  if (w.weight) parts.push(`${w.weight} kg`);
  return parts.join(' · ');
}

// --- NAVEGACIÓN DE SUB-PESTAÑAS ---
function setGymSubview(sub) {
  currentGymSub = sub;
  const map = { entreno: 'gymEntrenoSubview', progress: 'gymProgressSubview' };
  Object.values(map).forEach(v => hide(v));
  show(map[sub]);
  document.querySelectorAll('.gym-sub-btn').forEach(b => {
    const active = b.dataset.gymsub === sub;
    b.classList.toggle('bg-sky-500', active);
    b.classList.toggle('text-white', active);
    b.classList.toggle('text-slate-400', !active);
  });
  renderGym();
}
document.querySelectorAll('.gym-sub-btn').forEach(btn => {
  btn.addEventListener('click', () => setGymSubview(btn.dataset.gymsub));
});

// --- PERSISTENCIA ---
async function persistSession(date, patch) {
  const existing = getSession(date);
  const payload = { date, ...patch, updatedAt: new Date().toISOString() };
  if (!existing) payload.createdAt = new Date().toISOString();
  await setDoc(doc(db, 'users', currentUser.uid, 'sessions', date), payload, { merge: true });
}

async function deleteSession(date) {
  await deleteDoc(doc(db, 'users', currentUser.uid, 'sessions', date));
}

// --- RACHA ---
function calcStreak(dates) {
  const set = new Set(dates);
  let streak = 0;
  const d = new Date();
  if (!set.has(d.toISOString().split('T')[0])) d.setDate(d.getDate() - 1);
  while (set.has(d.toISOString().split('T')[0])) {
    streak++;
    d.setDate(d.getDate() - 1);
  }
  return streak;
}

// --- ENTRENO (rutina + asistencia juntos) ---
$('gymEntrenoDate').addEventListener('change', (e) => {
  gymEditDate = e.target.value || todayStr();
  renderEntreno();
});

$('gymEntrenoWeight').addEventListener('change', async (e) => {
  const raw = e.target.value.trim();
  const bodyWeight = raw === '' ? null : parseFloat(raw);
  if (raw !== '' && (isNaN(bodyWeight) || bodyWeight <= 0)) { alert('Peso no válido.'); return; }
  await persistSession(gymEditDate, { bodyWeight });
});

// Modal de ejercicio (añadir / editar)
function openExerciseModal(idx = null) {
  editingExerciseIdx = idx;
  const sess = getSession(gymEditDate);
  const ex = (idx !== null && sess && sess.exercises) ? sess.exercises[idx] : null;
  $('exName').value = ex ? ex.name : '';
  $('exSets').value = ex && ex.sets ? ex.sets : '';
  $('exReps').value = ex && ex.reps ? ex.reps : '';
  $('exWeight').value = ex && ex.weight ? ex.weight : '';
  $('exerciseModalTitle').textContent = idx !== null ? 'Editar' : 'Añadir';
  show('exerciseModal');
  setTimeout(() => $('exName').focus(), 50);
}
$('addExerciseBtn').addEventListener('click', () => openExerciseModal(null));
$('closeExerciseBtn').addEventListener('click', () => hide('exerciseModal'));
$('exerciseModal').addEventListener('click', (e) => { if (e.target.id === 'exerciseModal') hide('exerciseModal'); });

$('confirmExerciseBtn').addEventListener('click', async () => {
  const name = $('exName').value.trim();
  if (!name) { alert('Pon el nombre del ejercicio.'); return; }
  const ex = {
    name,
    sets: Number($('exSets').value) || 0,
    reps: Number($('exReps').value) || 0,
    weight: Number($('exWeight').value) || 0
  };
  const btn = $('confirmExerciseBtn');
  btn.disabled = true;
  try {
    const sess = getSession(gymEditDate);
    const exercises = sess && sess.exercises ? [...sess.exercises] : [];
    if (editingExerciseIdx !== null) exercises[editingExerciseIdx] = ex;
    else exercises.push(ex);
    await persistSession(gymEditDate, { exercises });
    hide('exerciseModal');
  } catch (err) {
    console.error('Error al guardar ejercicio:', err);
    alert('No se pudo guardar: ' + err.message);
  } finally {
    btn.disabled = false;
  }
});

function gymEditExercise(idx) { openExerciseModal(idx); }
window.gymEditExercise = gymEditExercise;

async function gymDeleteExercise(idx) {
  if (!confirm('¿Borrar este ejercicio?')) return;
  const sess = getSession(gymEditDate);
  if (!sess || !sess.exercises) return;
  const exercises = sess.exercises.filter((_, i) => i !== idx);
  await persistSession(gymEditDate, { exercises });
}
window.gymDeleteExercise = gymDeleteExercise;

// Cargar un día concreto en el editor (desde "Últimos días" o el calendario)
function gymLoadDay(date) {
  gymEditDate = date;
  setGymSubview('entreno');
  window.scrollTo(0, 0);
}
window.gymLoadDay = gymLoadDay;

function renderEntreno() {
  // Racha + entrenos del mes
  const dates = sessions.map(s => s.date);
  $('gymStreak').textContent = calcStreak(dates);
  const ym = new Date().toISOString().slice(0, 7);
  const monthCount = sessions.filter(s => (s.date || '').startsWith(ym)).length;
  $('gymMonthCount').textContent = `${monthCount} ${monthCount === 1 ? 'entreno' : 'entrenos'} este mes`;

  // Día seleccionado
  $('gymEntrenoDate').value = gymEditDate;
  const sess = getSession(gymEditDate);

  // Peso del día (no sobreescribir si lo está editando)
  const wEl = $('gymEntrenoWeight');
  if (document.activeElement !== wEl) wEl.value = (sess && sess.bodyWeight != null) ? sess.bodyWeight : '';

  // Badge "día registrado"
  $('gymDayBadge').classList.toggle('hidden', !sess);

  // Ejercicios del día
  const list = $('gymExercisesList');
  const exs = (sess && sess.exercises) ? sess.exercises : [];
  if (exs.length === 0) {
    list.innerHTML = `<div class="bg-slate-950 rounded-xl p-6 border border-slate-800 border-dashed text-center"><p class="text-slate-500 text-sm">Sin ejercicios este día. Pulsa "Añadir ejercicio".</p></div>`;
  } else {
    list.innerHTML = exs.map((w, i) => {
      const detail = exDetail(w);
      return `
      <div class="bg-slate-950 rounded-xl p-3 border border-slate-800 flex items-center gap-3">
        <div class="w-9 h-9 rounded-full bg-sky-500/15 flex items-center justify-center shrink-0"><span class="text-base">🏋️</span></div>
        <div class="flex-1 min-w-0">
          <p class="text-white text-sm font-medium truncate">${escapeHtml(w.name)}</p>
          ${detail ? `<p class="text-slate-500 text-xs mt-0.5 font-mono">${detail}</p>` : ''}
        </div>
        <button onclick="gymEditExercise(${i})" class="shrink-0 w-8 h-8 rounded-full hover:bg-slate-800 flex items-center justify-center transition" aria-label="Editar">
          <svg class="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125"/></svg>
        </button>
        <button onclick="gymDeleteExercise(${i})" class="shrink-0 w-8 h-8 rounded-full hover:bg-red-950 flex items-center justify-center transition group" aria-label="Borrar">
          <svg class="w-4 h-4 text-slate-500 group-hover:text-red-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
        </button>
      </div>`;
    }).join('');
  }

  // Últimos días (sessions ya viene ordenado por fecha desc)
  const recent = sessions.slice(0, 8);
  const recentEl = $('gymRecentList');
  if (recent.length === 0) {
    recentEl.innerHTML = `<div class="bg-slate-900 rounded-2xl p-6 border border-slate-800 text-center"><p class="text-slate-400 text-sm">Aún no hay entrenos registrados.</p></div>`;
  } else {
    recentEl.innerHTML = recent.map(s => {
      const n = (s.exercises || []).length;
      const meta = [
        `${n} ${n === 1 ? 'ejercicio' : 'ejercicios'}`,
        (s.bodyWeight != null) ? `${s.bodyWeight} kg` : ''
      ].filter(Boolean).join(' · ');
      const active = s.date === gymEditDate;
      return `
      <button onclick="gymLoadDay('${s.date}')" class="w-full text-left bg-slate-900 rounded-xl py-2.5 px-4 border ${active ? 'border-sky-500' : 'border-slate-800'} flex items-center gap-3 transition">
        <span class="text-base">✅</span>
        <div class="flex-1 min-w-0">
          <p class="text-white text-sm capitalize truncate">${fmtDayShort(s.date)}</p>
          <p class="text-slate-500 text-xs font-mono">${meta}</p>
        </div>
        <svg class="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5"/></svg>
      </button>`;
    }).join('');
  }
}

// --- PROGRESO (peso + calendario) ---
$('gymCalPrev').addEventListener('click', () => {
  gymCalMonth = new Date(gymCalMonth.getFullYear(), gymCalMonth.getMonth() - 1, 1);
  renderCalendar();
});
$('gymCalNext').addEventListener('click', () => {
  gymCalMonth = new Date(gymCalMonth.getFullYear(), gymCalMonth.getMonth() + 1, 1);
  renderCalendar();
});

function renderProgress() {
  // Peso actual (último día con peso) y variación desde el primero
  const weighed = sessions.filter(s => s.bodyWeight != null); // desc por fecha
  if (weighed.length > 0) {
    $('currentWeight').textContent = weighed[0].bodyWeight;
    if (weighed.length > 1) {
      const diff = +(weighed[0].bodyWeight - weighed[weighed.length - 1].bodyWeight).toFixed(1);
      const arrow = diff > 0 ? '↑' : (diff < 0 ? '↓' : '→');
      $('weightChange').textContent = `${arrow} ${Math.abs(diff)} kg desde el inicio`;
      $('weightChange').className = `text-xs mt-3 font-mono ${diff > 0 ? 'text-amber-400' : (diff < 0 ? 'text-emerald-400' : 'text-slate-500')}`;
    } else {
      $('weightChange').textContent = 'Primer registro';
      $('weightChange').className = 'text-xs mt-3 font-mono text-slate-500';
    }
  } else {
    $('currentWeight').textContent = '—';
    $('weightChange').textContent = '';
  }
  renderCalendar();
}

function renderCalendar() {
  const y = gymCalMonth.getFullYear(), m = gymCalMonth.getMonth();
  $('gymCalLabel').textContent = gymCalMonth.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
  let startDow = new Date(y, m, 1).getDay(); // 0=Dom..6=Sáb
  startDow = (startDow + 6) % 7;             // 0=Lun..6=Dom (semana europea)
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const today = todayStr();
  const sessionDates = new Set(sessions.map(s => s.date));

  let cells = '';
  for (let i = 0; i < startDow; i++) cells += `<div></div>`;
  for (let day = 1; day <= daysInMonth; day++) {
    const ds = `${y}-${String(m + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const has = sessionDates.has(ds);
    const isToday = ds === today;
    const base = 'aspect-square rounded-xl flex items-center justify-center text-sm font-mono transition';
    const cls = has
      ? 'bg-sky-500 text-white font-medium'
      : 'bg-slate-950 border border-slate-800 text-slate-400 hover:border-sky-500';
    const ring = isToday ? ' ring-2 ring-sky-400 ring-offset-2 ring-offset-slate-900' : '';
    cells += `<button onclick="gymOpenDay('${ds}')" class="${base} ${cls}${ring}">${day}</button>`;
  }
  $('gymCalGrid').innerHTML = cells;
}

// Tocar un día del calendario: si tiene sesión -> detalle; si no -> editar ese día
function gymOpenDay(ds) {
  if (getSession(ds)) openDayModal(ds);
  else gymLoadDay(ds);
}
window.gymOpenDay = gymOpenDay;

// --- MODAL DETALLE DE DÍA ---
function openDayModal(ds) {
  dayModalDate = ds;
  const sess = getSession(ds);
  $('dayModalTitle').textContent = fmtDayLong(ds);
  $('dayModalTitle').classList.add('capitalize');
  $('dayModalWeight').textContent = (sess && sess.bodyWeight != null) ? `Peso del día: ${sess.bodyWeight} kg` : 'Sin peso registrado';
  const exs = (sess && sess.exercises) ? sess.exercises : [];
  const box = $('dayModalExercises');
  if (exs.length === 0) {
    box.innerHTML = `<p class="text-slate-500 text-sm">Sin ejercicios anotados.</p>`;
  } else {
    box.innerHTML = exs.map(w => {
      const detail = exDetail(w);
      return `
      <div class="bg-slate-950 rounded-xl p-3 border border-slate-800 flex items-center gap-3">
        <span class="text-base">🏋️</span>
        <div class="flex-1 min-w-0">
          <p class="text-white text-sm font-medium truncate">${escapeHtml(w.name)}</p>
          ${detail ? `<p class="text-slate-500 text-xs mt-0.5 font-mono">${detail}</p>` : ''}
        </div>
      </div>`;
    }).join('');
  }
  show('dayModal');
}
$('closeDayBtn').addEventListener('click', () => hide('dayModal'));
$('dayModal').addEventListener('click', (e) => { if (e.target.id === 'dayModal') hide('dayModal'); });
$('dayEditBtn').addEventListener('click', () => {
  if (dayModalDate) { hide('dayModal'); gymLoadDay(dayModalDate); }
});
$('dayDeleteBtn').addEventListener('click', async () => {
  if (!dayModalDate) return;
  if (!confirm('¿Borrar este día completo (peso y ejercicios)?')) return;
  await deleteSession(dayModalDate);
  hide('dayModal');
});

// --- EXPORTAR A CSV ---
// Formato largo: una fila por ejercicio (días sin ejercicios salen como una fila
// con el ejercicio vacío). Separador ';' y coma decimal para Excel en español.
$('exportGymBtn').addEventListener('click', exportGymCsv);

async function exportGymCsv() {
  if (!sessions.length) { alert('No hay entrenos para exportar.'); return; }
  const sep = ';';
  const headers = ['Fecha', 'Peso corporal (kg)', 'Ejercicio', 'Series', 'Repes', 'Peso (kg)', 'Nota'];
  const num = (v) => (v == null || v === '' || v === 0) ? '' : String(v).replace('.', ',');
  const esc = (v) => {
    const s = (v == null) ? '' : String(v);
    return /[";\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  // sessions viene en orden descendente; exportamos ascendente por fecha
  const ordered = [...sessions].sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  const rows = [];
  ordered.forEach(s => {
    const exs = (s.exercises && s.exercises.length) ? s.exercises : [null];
    exs.forEach(w => {
      rows.push([
        s.date || '',
        num(s.bodyWeight),
        w ? w.name : '',
        w && w.sets ? w.sets : '',
        w && w.reps ? w.reps : '',
        w ? num(w.weight) : '',
        s.note || ''
      ].map(esc).join(sep));
    });
  });
  const csv = '\uFEFF' + headers.join(sep) + '\n' + rows.join('\n');
  const filename = `gimnasio_${todayStr()}.csv`;
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });

  // En iPhone/móvil usamos la hoja de compartir si está disponible
  try {
    const file = new File([blob], filename, { type: 'text/csv' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: 'Gimnasio' });
      return;
    }
  } catch (e) {
    if (e && e.name === 'AbortError') return; // el usuario canceló
    // cualquier otro fallo: caemos al método de descarga
  }

  // Fallback: descarga por enlace
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// --- RENDER GENERAL (llamado desde el listener de sessions) ---
function renderGym() {
  renderEntreno();
  renderProgress();
}
