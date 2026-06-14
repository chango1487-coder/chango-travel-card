// === TARJETAS (multi-tarjeta) ===
const UNASSIGNED = '__unassigned__';

// --- Helpers de tarjeta activa / viajes por tarjeta ---
function getActiveCard() {
  if (activeCardId === UNASSIGNED) return null;
  return cards.find(c => c.id === activeCardId) || null;
}
function cardTrips(cardId) {
  return trips.filter(t => (t.cardId || null) === cardId);
}
function getUnassignedTrips() {
  const ids = cards.map(c => c.id);
  return trips.filter(t => !t.cardId || !ids.includes(t.cardId));
}
function resolveActiveCard() {
  const ids = cards.map(c => c.id);
  const hasUnassigned = getUnassignedTrips().length > 0;
  if (activeCardId === UNASSIGNED && hasUnassigned) return;
  if (activeCardId && ids.includes(activeCardId)) return;
  activeCardId = ids[0] || (hasUnassigned ? UNASSIGNED : null);
}

// --- Migración suave: crea una tarjeta por defecto si no hay ninguna ---
async function ensureDefaultCard() {
  if (creatingDefaultCard) return;
  creatingDefaultCard = true;
  try {
    await addDoc(collection(db, 'users', currentUser.uid, 'cards'), {
      name: 'Mi tarjeta',
      cost: settings.cardCost ?? 600,
      ticketPrice: settings.ticketPrice ?? 24,
      startDate: settings.startDate ?? '',
      expirationDate: settings.expirationDate ?? '',
      createdAt: new Date().toISOString()
    });
  } catch (e) {
    console.error('No se pudo crear la tarjeta por defecto:', e);
    creatingDefaultCard = false;
  }
}

// --- Selector de tarjetas (pills) ---
function setActiveCard(id) {
  activeCardId = id;
  renderCardTabs();
  render();
  renderHome();
  updateFab();
}
window.setActiveCard = setActiveCard;

function renderCardTabs() {
  const wrap = $('cardTabs');
  if (!wrap) return;
  resolveActiveCard();
  const hasUnassigned = getUnassignedTrips().length > 0;

  let html = cards.map(c => {
    const active = c.id === activeCardId;
    const cls = active
      ? 'bg-sky-500 text-white'
      : 'bg-slate-900 border border-slate-800 text-slate-400';
    return `<button onclick="setActiveCard('${c.id}')" class="shrink-0 px-4 py-2 rounded-full text-xs font-medium transition ${cls}">${escapeHtml(c.name || 'Tarjeta')}</button>`;
  }).join('');

  if (hasUnassigned) {
    const active = activeCardId === UNASSIGNED;
    const cls = active
      ? 'bg-slate-700 text-white'
      : 'bg-slate-900 border border-slate-800 text-slate-500';
    html += `<button onclick="setActiveCard('${UNASSIGNED}')" class="shrink-0 px-4 py-2 rounded-full text-xs font-medium transition ${cls}">Sin asignar</button>`;
  }

  html += `<button onclick="openCardModal()" class="shrink-0 px-4 py-2 rounded-full text-xs font-medium bg-slate-900 border border-dashed border-slate-700 text-sky-400 hover:border-sky-500 transition">+ Nueva</button>`;

  wrap.innerHTML = html;
}

// --- Modal nueva tarjeta ---
function openCardModal() {
  $('newCardName').value = '';
  $('newCardCost').value = 600;
  $('newCardTicket').value = 24;
  $('newCardStart').value = new Date().toISOString().split('T')[0];
  $('newCardExpiration').value = '';
  show('cardModal');
}
window.openCardModal = openCardModal;
$('closeCardBtn').addEventListener('click', () => hide('cardModal'));
$('cardModal').addEventListener('click', (e) => { if (e.target.id === 'cardModal') hide('cardModal'); });

$('confirmCardBtn').addEventListener('click', async () => {
  const name = $('newCardName').value.trim() || 'Tarjeta';
  const cost = Number($('newCardCost').value) || 0;
  const ticketPrice = Number($('newCardTicket').value) || 0;
  const startDate = $('newCardStart').value || '';
  const expirationDate = $('newCardExpiration').value || '';
  const ref = await addDoc(collection(db, 'users', currentUser.uid, 'cards'), {
    name, cost, ticketPrice, startDate, expirationDate, createdAt: new Date().toISOString()
  });
  activeCardId = ref.id;
  hide('cardModal');
});

// --- Ajustes de la tarjeta activa (escriben en el doc de la tarjeta) ---
async function persistActiveCard(patch) {
  const card = getActiveCard();
  if (!card) return;
  await setDoc(doc(db, 'users', currentUser.uid, 'cards', card.id), patch, { merge: true });
}

['setCardName','setCardCost','setTicketPrice','setStartDate','setExpiration'].forEach(id => {
  $(id).addEventListener('change', async (e) => {
    const map = { setCardName: 'name', setCardCost: 'cost', setTicketPrice: 'ticketPrice', setStartDate: 'startDate', setExpiration: 'expirationDate' };
    const key = map[id];
    const val = e.target.type === 'number' ? Number(e.target.value) : e.target.value;
    await persistActiveCard({ [key]: val });
  });
});

// --- Borrar tarjeta activa ---
$('deleteCardBtn').addEventListener('click', async () => {
  const card = getActiveCard();
  if (!card) return;
  if (!confirm(`¿Borrar la tarjeta "${card.name || 'Tarjeta'}"?`)) return;
  const own = cardTrips(card.id);
  let deleteTrips = false;
  if (own.length) {
    deleteTrips = confirm(`Esta tarjeta tiene ${own.length} viaje(s).\n\nAceptar = borrar también esos viajes.\nCancelar = dejarlos sin asignar.`);
  }
  for (const t of own) {
    if (deleteTrips) {
      await deleteDoc(doc(db, 'users', currentUser.uid, 'trips', t.id));
    } else {
      await setDoc(doc(db, 'users', currentUser.uid, 'trips', t.id), { cardId: null }, { merge: true });
    }
  }
  await deleteDoc(doc(db, 'users', currentUser.uid, 'cards', card.id));
  activeCardId = null; // se reasignará a la primera tarjeta disponible
});

// --- Reasignar viajes sin asignar ---
$('reassignBtn').addEventListener('click', async () => {
  const target = $('reassignCardSelect').value;
  if (!target) return;
  const list = getUnassignedTrips();
  if (!list.length) return;
  if (!confirm(`¿Asignar ${list.length} viaje(s) a esta tarjeta?`)) return;
  for (const t of list) {
    await setDoc(doc(db, 'users', currentUser.uid, 'trips', t.id), { cardId: target }, { merge: true });
  }
  activeCardId = target;
});

// === TRIPS ===
$('addBtn').addEventListener('click', () => {
  if (currentMainView === 'expenses') {
    if (currentExpSub === 'savings') openSavingsModal();
    else openExpenseModal();
    return;
  }
  // Para registrar un viaje hace falta al menos una tarjeta.
  if (cards.length === 0) { openCardModal(); return; }
  setAddType('trip');
  $('newTripDate').value = new Date().toISOString().split('T')[0];
  $('newTripNote').value = '';
  $('newTripCost').value = '';
  const target = getActiveCard() || cards[0];
  const lbl = $('addTripCardLabel');
  if (lbl) lbl.textContent = target ? `Se añadirá a: ${target.name || 'Tarjeta'}` : '';
  show('addModal');
});
$('closeModalBtn').addEventListener('click', () => hide('addModal'));
$('addModal').addEventListener('click', (e) => { if (e.target.id === 'addModal') hide('addModal'); });

let addType = 'trip';
function setAddType(type) {
  addType = type;
  const isExtra = type === 'extra';
  $('extraAmountWrap').classList.toggle('hidden', !isExtra);
  $('addModalTitle').textContent = isExtra ? 'Billete extra' : 'Registrar viaje';
  $('confirmAddBtn').textContent = isExtra ? 'Añadir billete' : 'Añadir viaje';
  const tripBtn = $('tripTypeTrip'), extraBtn = $('tripTypeExtra');
  tripBtn.classList.toggle('bg-sky-500', !isExtra);
  tripBtn.classList.toggle('text-white', !isExtra);
  tripBtn.classList.toggle('text-slate-400', isExtra);
  extraBtn.classList.toggle('bg-sky-500', isExtra);
  extraBtn.classList.toggle('text-white', isExtra);
  extraBtn.classList.toggle('text-slate-400', !isExtra);
}
$('tripTypeTrip').addEventListener('click', () => setAddType('trip'));
$('tripTypeExtra').addEventListener('click', () => setAddType('extra'));

$('confirmAddBtn').addEventListener('click', async () => {
  const date = $('newTripDate').value;
  const note = $('newTripNote').value.trim();
  if (!date) return;
  const target = getActiveCard() || cards[0];
  const cardId = target ? target.id : null;
  if (addType === 'extra') {
    const cost = Number($('newTripCost').value);
    if (!cost || cost <= 0) return;
    await addDoc(collection(db, 'users', currentUser.uid, 'trips'), {
      date, note, cost, extra: true, cardId, createdAt: new Date().toISOString()
    });
  } else {
    await addDoc(collection(db, 'users', currentUser.uid, 'trips'), {
      date, note, cardId, createdAt: new Date().toISOString()
    });
  }
  hide('addModal');
});

async function deleteTrip(id) {
  if (!confirm('¿Borrar este viaje?')) return;
  await deleteDoc(doc(db, 'users', currentUser.uid, 'trips', id));
}
window.deleteTrip = deleteTrip;


// === RENDER (sobre la tarjeta seleccionada) ===
function render() {
  renderCardTabs();
  renderCardSettings();

  const card = getActiveCard();
  const isUnassigned = (activeCardId === UNASSIGNED) || !card;
  const relevant = isUnassigned ? getUnassignedTrips() : cardTrips(card.id);

  const realTrips = relevant.filter(t => !t.extra);
  const extraTickets = relevant.filter(t => t.extra);
  const total = realTrips.length;
  const extraTotal = extraTickets.reduce((s, t) => s + (t.cost || 0), 0);

  const cost = card ? (card.cost || 0) : 0;
  const ticket = card ? (card.ticketPrice || 0) : 0;
  const breakeven = (card && ticket > 0) ? Math.ceil(cost / ticket) : 0;
  const valueUsed = total * ticket;
  const savings = valueUsed - cost;
  const progress = breakeven > 0 ? Math.min(100, (total / breakeven) * 100) : 0;
  const worthIt = breakeven > 0 && total >= breakeven;
  const costPerTrip = (total > 0 && cost > 0) ? (cost / total).toFixed(2) : '—';

  // Hero
  const heroLabel = $('heroLabel');
  const heroValue = $('heroValue');
  const heroCurrency = $('heroCurrency');
  const progressFill = $('progressFill');
  if (isUnassigned) {
    heroLabel.textContent = 'Viajes sin asignar';
    heroValue.textContent = total;
    heroValue.className = 'font-mono text-5xl text-slate-300';
    if (heroCurrency) heroCurrency.classList.add('hidden');
    progressFill.className = 'progress-bar h-full bg-slate-600';
  } else if (worthIt) {
    heroLabel.textContent = 'Ahorro acumulado';
    heroValue.textContent = '+' + savings;
    heroValue.className = 'font-mono text-5xl text-emerald-400';
    if (heroCurrency) heroCurrency.classList.remove('hidden');
    progressFill.className = 'progress-bar h-full bg-emerald-400';
  } else {
    heroLabel.textContent = 'Falta para amortizar';
    heroValue.textContent = (breakeven - total) * ticket;
    heroValue.className = 'font-mono text-5xl text-sky-400';
    if (heroCurrency) heroCurrency.classList.remove('hidden');
    progressFill.className = 'progress-bar h-full bg-sky-400';
  }
  heroValue.style.fontWeight = 500;
  progressFill.style.width = progress + '%';
  $('progressText').textContent = breakeven > 0 ? `${total} de ${breakeven} viajes` : `${total} viajes`;
  $('progressPct').textContent = Math.round(progress) + '%';

  // Stats
  $('statTrips').textContent = total;
  $('statCost').textContent = costPerTrip;

  // Summary
  $('sumCard').textContent = card ? (cost + ' kr') : '—';
  $('sumValue').textContent = card ? (valueUsed + ' kr') : '—';
  $('sumExtra').textContent = extraTickets.length ? `${extraTotal} kr · ${extraTickets.length}` : '—';
  $('sumTotal').textContent = card ? ((cost || 0) + extraTotal) + ' kr' : (extraTotal ? extraTotal + ' kr' : '—');
  $('sumBreakeven').textContent = breakeven > 0 ? breakeven + ' viajes' : '—';

  // Expiration
  const expBadge = $('expirationBadge');
  const expText = $('expirationText');
  const expDateEl = $('expirationDate');
  const sumExp = $('sumExpiration');
  const expirationDate = card ? card.expirationDate : '';
  if (expirationDate) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const exp = new Date(expirationDate);
    exp.setHours(0, 0, 0, 0);
    const diffDays = Math.round((exp - today) / (1000 * 60 * 60 * 24));
    const fmt = exp.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
    sumExp.textContent = fmt;
    expBadge.classList.remove('hidden');
    expDateEl.textContent = fmt;
    if (diffDays > 1) {
      expText.textContent = `Caduca en ${diffDays} días`;
      expBadge.className = 'rounded-2xl px-4 py-3 flex items-center justify-between border bg-slate-900 border-slate-800 text-slate-300';
    } else if (diffDays === 1) {
      expText.textContent = 'Caduca mañana';
      expBadge.className = 'rounded-2xl px-4 py-3 flex items-center justify-between border bg-amber-950 border-amber-900 text-amber-300';
    } else if (diffDays === 0) {
      expText.textContent = 'Caduca hoy';
      expBadge.className = 'rounded-2xl px-4 py-3 flex items-center justify-between border bg-amber-950 border-amber-900 text-amber-300';
    } else {
      expText.textContent = `Caducó hace ${Math.abs(diffDays)} días`;
      expBadge.className = 'rounded-2xl px-4 py-3 flex items-center justify-between border bg-red-950 border-red-900 text-red-300';
    }
  } else {
    expBadge.classList.add('hidden');
    sumExp.textContent = '—';
  }

  const status = $('sumStatus');
  if (isUnassigned) {
    status.textContent = '—';
    status.className = 'font-medium text-slate-400';
  } else if (worthIt) {
    status.textContent = '✓ Rentable';
    status.className = 'font-medium text-emerald-400';
  } else {
    status.textContent = '○ Aún no';
    status.className = 'font-medium text-amber-400';
  }

  // History
  $('historyCount').textContent = `${total} ${total === 1 ? 'viaje registrado' : 'viajes registrados'}`;
  const list = $('tripsList');
  if (relevant.length === 0) {
    list.innerHTML = `
      <div class="bg-slate-900 rounded-2xl p-10 border border-slate-800 text-center">
        <p class="text-slate-400 text-sm">Sin viajes aún. Pulsa + para añadir.</p>
      </div>`;
  } else {
    let tripNo = total;
    list.innerHTML = relevant.map((t) => {
      const dateStr = new Date(t.date).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
      const trash = `<button onclick="deleteTrip('${t.id}')" class="w-9 h-9 rounded-full hover:bg-red-950 flex items-center justify-center transition group">
            <svg class="w-4 h-4 text-slate-500 group-hover:text-red-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"/></svg>
          </button>`;
      if (t.extra) {
        return `
      <div class="bg-slate-900 rounded-2xl p-4 border border-slate-800 flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-full bg-amber-950 border border-amber-900 flex items-center justify-center">
            <span class="text-sm">🎫</span>
          </div>
          <div>
            <div class="flex items-center gap-2">
              <p class="text-white text-sm font-medium">${dateStr}</p>
              <span class="text-[10px] uppercase tracking-wider text-amber-400 bg-amber-950 border border-amber-900 rounded-full px-2 py-0.5">Extra</span>
            </div>
            ${t.note ? `<p class="text-slate-400 text-xs mt-0.5">${escapeHtml(t.note)}</p>` : ''}
          </div>
        </div>
        <div class="flex items-center gap-2">
          <span class="font-mono text-sm text-amber-400">${t.cost || 0} kr</span>
          ${trash}
        </div>
      </div>`;
      }
      const n = tripNo--;
      return `
      <div class="bg-slate-900 rounded-2xl p-4 border border-slate-800 flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center">
            <span class="font-mono text-xs text-sky-400">${n}</span>
          </div>
          <div>
            <p class="text-white text-sm font-medium">${dateStr}</p>
            ${t.note ? `<p class="text-slate-400 text-xs mt-0.5">${escapeHtml(t.note)}</p>` : ''}
          </div>
        </div>
        ${trash}
      </div>`;
    }).join('');
  }
}

// --- Ajustes: rellenar/mostrar según tarjeta activa o "sin asignar" ---
function renderCardSettings() {
  const card = getActiveCard();
  const isUnassigned = (activeCardId === UNASSIGNED) || !card;
  const form = $('cardSettingsForm');
  const del = $('deleteCardBtn');
  const un = $('unassignedSettings');
  if (!form) return;

  if (isUnassigned) {
    form.classList.add('hidden');
    if (del) del.classList.add('hidden');
    if (un) un.classList.remove('hidden');
    const sel = $('reassignCardSelect');
    if (sel) sel.innerHTML = cards.map(c => `<option value="${c.id}">${escapeHtml(c.name || 'Tarjeta')}</option>`).join('');
  } else {
    form.classList.remove('hidden');
    if (del) del.classList.remove('hidden');
    if (un) un.classList.add('hidden');
    $('setCardName').value = card.name || '';
    $('setCardCost').value = card.cost ?? '';
    $('setTicketPrice').value = card.ticketPrice ?? '';
    $('setStartDate').value = card.startDate || '';
    $('setExpiration').value = card.expirationDate || '';
  }
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
