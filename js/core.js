// === SETTINGS ===
async function persistSettings() {
  await setDoc(doc(db, 'users', currentUser.uid), settings, { merge: true });
}

function renderSettings() {
  // Los parámetros de la tarjeta (coste/billete/fechas) ya NO viven aquí:
  // se editan por tarjeta en la pestaña Tarjeta › Ajustes (ver card.js).
  $('setBudget').value = settings.monthlyBudget || '';
  $('setSavingsGoal').value = settings.savingsGoal || '';
}

['setBudget','setSavingsGoal'].forEach(id => {
  $(id).addEventListener('change', async (e) => {
    const map = { setBudget: 'monthlyBudget', setSavingsGoal: 'savingsGoal' };
    const key = map[id];
    const val = e.target.type === 'number' ? Number(e.target.value) : e.target.value;
    settings[key] = val;
    await persistSettings();
    renderExpenses();
    renderSavings();
  });
});


// === HOME (inicio) ===
function goTo(view, sub) {
  setMainView(view);
  if (view === 'card' && sub) setCardSubview(sub);
  if (view === 'expenses' && sub) setExpSubview(sub);
  if (view === 'gym' && sub) setGymSubview(sub);
  if (view === 'worldcup' && sub) setWcSubview(sub);
  window.scrollTo(0, 0);
}
window.goTo = goTo;

function renderHome() {
  // Fecha
  const d = new Date();
  const fecha = d.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
  const dEl = $('homeDate');
  if (dEl) dEl.textContent = fecha;

  // Tarjeta (sobre la tarjeta activa, o la primera disponible)
  const homeCard = (typeof getActiveCard === 'function' ? getActiveCard() : null) || (cards[0] || null);
  const tEl = $('homeTarjeta');
  if (tEl) {
    if (homeCard) {
      const ct = trips.filter(t => !t.extra && (t.cardId || null) === homeCard.id).length;
      const be = Math.ceil((homeCard.cost || 0) / (homeCard.ticketPrice || 1));
      tEl.textContent = (be > 0 && ct >= be) ? `${ct} viajes · rentable` : `${ct} / ${be} viajes`;
    } else {
      tEl.textContent = '—';
    }
  }

  // Gastos (mes actual)
  const ym = new Date().toISOString().slice(0, 7);
  const monthExp = expenses.filter(e => (e.date || '').startsWith(ym));
  const spent = monthExp.reduce((s, e) => s + (e.amount || 0), 0) + fixedExpenses.reduce((s, f) => s + (f.amount || 0), 0);
  const budget = settings.monthlyBudget || 0;
  const gEl = $('homeGastos');
  if (gEl) gEl.textContent = budget > 0 ? `${budget - spent} kr disp.` : `${spent} kr`;

  // Ahorros
  const totalSav = savings.reduce((s, x) => s + (x.amount || 0), 0);
  const aEl = $('homeAhorros');
  if (aEl) aEl.textContent = `${totalSav} kr`;

  // Súper (productos pendientes en total)
  const pendShop = shopping.filter(i => !i.done).length;
  const sEl = $('homeSuper');
  if (sEl) sEl.textContent = `${pendShop} ${pendShop === 1 ? 'pendiente' : 'pendientes'}`;

  // Tareas pendientes
  const pendTodo = todos.filter(t => !t.done).length;
  const toEl = $('homeTareas');
  if (toEl) toEl.textContent = `${pendTodo} ${pendTodo === 1 ? 'pendiente' : 'pendientes'}`;

  // Gimnasio (entrenos este mes)
  const ymG = new Date().toISOString().slice(0, 7);
  const gymMonth = sessions.filter(v => (v.date || '').startsWith(ymG)).length;
  const gEl2 = $('homeGym');
  if (gEl2) gEl2.textContent = `${gymMonth} ${gymMonth === 1 ? 'entreno' : 'entrenos'}/mes`;
}

// === NAVIGATION ===
let currentMainView = 'card';
let currentCardSub = 'dashboard';
let currentExpSub = 'month';
const HEADER_TITLES = { home: 'David Benavides Chang', card: 'David — Commuter Card', expenses: 'David — Gastos', super: 'David — Súper', todos: 'David — Tareas', gym: 'David — Gimnasio', worldcup: 'David — Mundial' };
function setMainView(view) {
  currentMainView = view;
  ['homeView','cardView','expensesView','superView','todosView','gymView','worldcupView'].forEach(v => hide(v));
  show(view + 'View');
  document.querySelectorAll('.nav-btn').forEach(b => {
    const active = b.dataset.view === view;
    b.classList.toggle('text-sky-400', active);
    b.classList.toggle('text-slate-500', !active);
  });
  $('headerTitle').textContent = HEADER_TITLES[view] || '';
  updateFab();
}
function setCardSubview(sub) {
  currentCardSub = sub;
  ['dashboardSubview','historySubview','settingsSubview'].forEach(v => hide(v));
  show(sub + 'Subview');
  document.querySelectorAll('.card-sub-btn').forEach(b => {
    const active = b.dataset.subview === sub;
    b.classList.toggle('bg-sky-500', active);
    b.classList.toggle('text-white', active);
    b.classList.toggle('text-slate-400', !active);
  });
  updateFab();
}
function setExpSubview(sub) {
  currentExpSub = sub;
  const map = { month: 'expMonthSubview', history: 'expHistorySubview', savings: 'expSavingsSubview', settings: 'expSettingsSubview' };
  Object.values(map).forEach(v => hide(v));
  show(map[sub]);
  document.querySelectorAll('.exp-sub-btn').forEach(b => {
    const active = b.dataset.expsub === sub;
    b.classList.toggle('bg-sky-500', active);
    b.classList.toggle('text-white', active);
    b.classList.toggle('text-slate-400', !active);
  });
  updateFab();
}
function updateFab() {
  let visible = false;
  if (currentMainView === 'card' && (currentCardSub === 'dashboard' || currentCardSub === 'history')) visible = true;
  if (currentMainView === 'expenses' && (currentExpSub === 'month' || currentExpSub === 'history' || currentExpSub === 'savings')) visible = true;
  $('addBtn').classList.toggle('hidden', !visible);
}
document.querySelectorAll('.nav-btn').forEach(btn => {
  btn.addEventListener('click', () => setMainView(btn.dataset.view));
});
document.querySelectorAll('.card-sub-btn').forEach(btn => {
  btn.addEventListener('click', () => setCardSubview(btn.dataset.subview));
});
document.querySelectorAll('.exp-sub-btn').forEach(btn => {
  btn.addEventListener('click', () => setExpSubview(btn.dataset.expsub));
});
