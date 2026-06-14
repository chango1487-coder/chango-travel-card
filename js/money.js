// === EXPENSES ===
const EXPENSE_CATEGORIES = [
  { id: 'comida',     label: 'Comida',     emoji: '🍽️', color: '#f97316' },
  { id: 'super',      label: 'Súper',      emoji: '🛒', color: '#22c55e' },
  { id: 'transporte', label: 'Transporte', emoji: '🚇', color: '#38bdf8' },
  { id: 'ocio',       label: 'Ocio',       emoji: '🎬', color: '#a855f7' },
  { id: 'salud',      label: 'Salud',      emoji: '🏥', color: '#ef4444' },
  { id: 'casa',       label: 'Casa',       emoji: '🏠', color: '#eab308' },
  { id: 'compras',    label: 'Compras',    emoji: '🛍️', color: '#ec4899' },
  { id: 'otros',      label: 'Otros',      emoji: '📦', color: '#94a3b8' },
];
const catById = (id) => EXPENSE_CATEGORIES.find(c => c.id === id) || EXPENSE_CATEGORIES[EXPENSE_CATEGORIES.length - 1];
let selectedCategory = 'comida';

// === CURRENCY (todo se guarda en DKK) ===
const CURRENCIES = ['DKK','EUR','USD','GBP','SEK','NOK'];
// Fallback aproximado (1 unidad = N DKK) por si falla la red
let rates = { DKK: 1, EUR: 7.46, USD: 6.9, GBP: 8.7, SEK: 0.65, NOK: 0.63 };
let preferredCurrency = 'DKK';

async function loadRates() {
  try {
    const res = await fetch('https://api.frankfurter.app/latest?from=DKK&to=EUR,USD,GBP,SEK,NOK');
    const data = await res.json();
    const r = { DKK: 1 };
    for (const [cur, val] of Object.entries(data.rates)) r[cur] = 1 / val;
    rates = r;
  } catch (e) {
    console.warn('No se pudieron cargar tasas en vivo, usando aproximadas.', e);
  }
}
const toDKK = (amount, currency) => Math.round(amount * (rates[currency] || 1));

function populateCurrencySelects() {
  document.querySelectorAll('.cur-select').forEach(sel => {
    sel.innerHTML = CURRENCIES.map(c => `<option value="${c}">${c}</option>`).join('');
    sel.value = preferredCurrency;
  });
}
function syncPreferredCurrency(cur) { preferredCurrency = cur; }
function origLabel(e) {
  return (e.originalCurrency && e.originalCurrency !== 'DKK')
    ? ` · ${e.originalAmount} ${e.originalCurrency}` : '';
}

function renderCategoryPicker() {
  const picker = $('categoryPicker');
  picker.innerHTML = EXPENSE_CATEGORIES.map(c => `
    <button type="button" data-cat="${c.id}" class="cat-pick flex flex-col items-center gap-1 py-2 rounded-xl border transition ${c.id === selectedCategory ? 'border-sky-500 bg-sky-500/10' : 'border-slate-800 bg-slate-950'}">
      <span class="text-lg">${c.emoji}</span>
      <span class="text-[10px] text-slate-400">${c.label}</span>
    </button>`).join('');
  picker.querySelectorAll('.cat-pick').forEach(btn => {
    btn.addEventListener('click', () => { selectedCategory = btn.dataset.cat; renderCategoryPicker(); });
  });
}

function openExpenseModal() {
  $('newExpAmount').value = '';
  $('newExpNote').value = '';
  $('newExpDate').value = new Date().toISOString().split('T')[0];
  $('newExpCurrency').value = preferredCurrency;
  $('newExpConverted').textContent = '';
  selectedCategory = 'comida';
  renderCategoryPicker();
  show('expenseModal');
  setTimeout(() => $('newExpAmount').focus(), 50);
}
function updateExpConverted() {
  const amt = parseFloat($('newExpAmount').value) || 0;
  const cur = $('newExpCurrency').value;
  $('newExpConverted').textContent = (cur === 'DKK' || !amt) ? '' : `≈ ${toDKK(amt, cur)} DKK`;
}
$('newExpAmount').addEventListener('input', updateExpConverted);
$('newExpCurrency').addEventListener('change', () => { syncPreferredCurrency($('newExpCurrency').value); updateExpConverted(); });
$('closeExpenseBtn').addEventListener('click', () => hide('expenseModal'));
$('expenseModal').addEventListener('click', (e) => { if (e.target.id === 'expenseModal') hide('expenseModal'); });

$('confirmExpenseBtn').addEventListener('click', async () => {
  const entered = parseFloat($('newExpAmount').value);
  if (!entered || entered <= 0) return;
  const cur = $('newExpCurrency').value;
  await addDoc(collection(db, 'users', currentUser.uid, 'expenses'), {
    amount: toDKK(entered, cur),
    originalAmount: entered,
    originalCurrency: cur,
    category: selectedCategory,
    note: $('newExpNote').value.trim(),
    date: $('newExpDate').value,
    createdAt: new Date().toISOString()
  });
  hide('expenseModal');
});

async function deleteExpense(id) {
  if (!confirm('¿Borrar este gasto?')) return;
  await deleteDoc(doc(db, 'users', currentUser.uid, 'expenses', id));
}
window.deleteExpense = deleteExpense;

// === FIXED EXPENSES (gastos fijos) ===
// Poblar el select de categorías una vez
(function initFixedCategorySelect() {
  const sel = $('newFixedCategory');
  if (sel) sel.innerHTML = EXPENSE_CATEGORIES.map(c => `<option value="${c.id}">${c.emoji} ${c.label}</option>`).join('');
})();

async function addFixed() {
  const name = $('newFixedName').value.trim();
  const entered = parseFloat($('newFixedAmount').value);
  const category = $('newFixedCategory').value;
  const cur = $('newFixedCurrency').value;
  if (!name || !entered || entered <= 0) return;
  await addDoc(collection(db, 'users', currentUser.uid, 'fixedExpenses'), {
    name,
    amount: toDKK(entered, cur),
    originalAmount: entered,
    originalCurrency: cur,
    category,
    createdAt: new Date().toISOString()
  });
  $('newFixedName').value = '';
  $('newFixedAmount').value = '';
  $('newFixedConverted').textContent = '';
  $('newFixedName').focus();
}
function updateFixedConverted() {
  const amt = parseFloat($('newFixedAmount').value) || 0;
  const cur = $('newFixedCurrency').value;
  $('newFixedConverted').textContent = (cur === 'DKK' || !amt) ? '' : `≈ ${toDKK(amt, cur)} DKK/mes`;
}
$('newFixedAmount').addEventListener('input', updateFixedConverted);
$('newFixedCurrency').addEventListener('change', () => { syncPreferredCurrency($('newFixedCurrency').value); updateFixedConverted(); });
$('addFixedBtn').addEventListener('click', addFixed);
$('newFixedAmount').addEventListener('keydown', (e) => { if (e.key === 'Enter') addFixed(); });

async function deleteFixed(id) {
  await deleteDoc(doc(db, 'users', currentUser.uid, 'fixedExpenses', id));
}
window.deleteFixed = deleteFixed;

function renderFixed() {
  const total = fixedExpenses.reduce((s, f) => s + (f.amount || 0), 0);
  $('fixedTotal').textContent = `${total} kr/mes`;
  const list = $('fixedList');
  if (fixedExpenses.length === 0) {
    list.innerHTML = '<p class="text-slate-500 text-xs">Sin gastos fijos aún.</p>';
    return;
  }
  list.innerHTML = fixedExpenses.map(f => {
    const c = catById(f.category);
    return `
    <div class="flex items-center gap-2 bg-slate-950 rounded-lg px-3 py-2.5">
      <span class="text-base">${c.emoji}</span>
      <span class="flex-1 text-sm text-white truncate">${escapeHtml(f.name)}</span>
      <span class="font-mono text-sm text-slate-300">${f.amount} kr</span>
      <button onclick="deleteFixed('${f.id}')" class="shrink-0 w-7 h-7 rounded-full hover:bg-red-950 flex items-center justify-center transition group" aria-label="Borrar">
        <svg class="w-3.5 h-3.5 text-slate-500 group-hover:text-red-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
      </button>
    </div>`;
  }).join('');
}

// === WALLETS (carteras de ahorro) ===
const WALLET_EMOJIS = ['💰','🏦','🚨','✈️','🏠','🚗','💼','🎁','📈','🎓'];
const WALLET_COLORS = ['#10b981','#38bdf8','#f97316','#a855f7','#ec4899','#eab308','#ef4444','#14b8a6'];
let selectedWalletEmoji = '💰';
const walletById = (id) => wallets.find(w => w.id === id);

function renderWalletEmojiPicker() {
  const p = $('walletEmojiPicker');
  p.innerHTML = WALLET_EMOJIS.map(e => `
    <button type="button" data-emoji="${e}" class="wemoji-pick text-xl py-2 rounded-lg border transition ${e === selectedWalletEmoji ? 'border-emerald-500 bg-emerald-500/10' : 'border-slate-800 bg-slate-950'}">${e}</button>`).join('');
  p.querySelectorAll('.wemoji-pick').forEach(b => b.addEventListener('click', () => { selectedWalletEmoji = b.dataset.emoji; renderWalletEmojiPicker(); }));
}

function openWalletModal() {
  $('newWalletName').value = '';
  selectedWalletEmoji = '💰';
  renderWalletEmojiPicker();
  show('walletModal');
  setTimeout(() => $('newWalletName').focus(), 50);
}
$('addWalletBtn').addEventListener('click', openWalletModal);
$('closeWalletBtn').addEventListener('click', () => hide('walletModal'));
$('walletModal').addEventListener('click', (e) => { if (e.target.id === 'walletModal') hide('walletModal'); });

$('confirmWalletBtn').addEventListener('click', async () => {
  const name = $('newWalletName').value.trim();
  if (!name) { alert('Ponle un nombre a la cartera.'); return; }
  const color = WALLET_COLORS[wallets.length % WALLET_COLORS.length];
  const btn = $('confirmWalletBtn');
  btn.disabled = true;
  try {
    await addDoc(collection(db, 'users', currentUser.uid, 'wallets'), {
      name, emoji: selectedWalletEmoji, color, createdAt: new Date().toISOString()
    });
    hide('walletModal');
  } catch (err) {
    console.error('Error al crear cartera:', err);
    alert('No se pudo crear la cartera: ' + err.message);
  } finally {
    btn.disabled = false;
  }
});

async function deleteWallet(id) {
  if (!confirm('¿Borrar esta cartera? Los ahorros que tenga pasarán a "General".')) return;
  await deleteDoc(doc(db, 'users', currentUser.uid, 'wallets', id));
}
window.deleteWallet = deleteWallet;

function renderWallets() {
  // Poblar el desplegable del modal de ahorro
  const sel = $('newSavingWallet');
  if (sel) {
    const prev = sel.value;
    sel.innerHTML = '<option value="">General</option>' + wallets.map(w => `<option value="${w.id}">${w.emoji} ${escapeHtml(w.name)}</option>`).join('');
    sel.value = prev;
  }
  // Saldos por cartera
  const walletIds = new Set(wallets.map(w => w.id));
  let generalBal = 0;
  const known = {};
  savings.forEach(s => {
    const k = s.walletId || '';
    if (k && walletIds.has(k)) known[k] = (known[k] || 0) + (s.amount || 0);
    else generalBal += (s.amount || 0);
  });

  const card = (w, balance, deletable) => `
    <div class="bg-slate-900 rounded-2xl p-4 border border-slate-800 flex items-center gap-3">
      <div class="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style="background-color:${w.color}22;"><span class="text-lg">${w.emoji}</span></div>
      <span class="flex-1 text-white text-sm font-medium truncate">${escapeHtml(w.name)}</span>
      <span class="font-mono text-emerald-400 shrink-0">${balance} kr</span>
      ${deletable ? `<button onclick="deleteWallet('${w.id}')" class="shrink-0 w-8 h-8 rounded-full hover:bg-red-950 flex items-center justify-center transition group" aria-label="Borrar"><svg class="w-3.5 h-3.5 text-slate-500 group-hover:text-red-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg></button>` : ''}
    </div>`;

  let html = '';
  if (generalBal > 0) html += card({ name: 'General', emoji: '💰', color: '#64748b' }, generalBal, false);
  html += wallets.map(w => card(w, known[w.id] || 0, true)).join('');
  const list = $('walletsList');
  if (wallets.length === 0 && generalBal === 0) {
    list.innerHTML = '<p class="text-slate-500 text-xs px-1">Sin carteras. Crea una con "+ Nueva" o añade un ahorro a "General".</p>';
  } else {
    list.innerHTML = html;
  }
}

// === SAVINGS (ahorros) ===
function openSavingsModal() {
  $('newSavingAmount').value = '';
  $('newSavingNote').value = '';
  $('newSavingDate').value = new Date().toISOString().split('T')[0];
  $('newSavingCurrency').value = preferredCurrency;
  $('newSavingConverted').textContent = '';
  renderWallets();
  $('newSavingWallet').value = '';
  show('savingsModal');
  setTimeout(() => $('newSavingAmount').focus(), 50);
}
function updateSavingConverted() {
  const amt = parseFloat($('newSavingAmount').value) || 0;
  const cur = $('newSavingCurrency').value;
  $('newSavingConverted').textContent = (cur === 'DKK' || !amt) ? '' : `≈ ${toDKK(amt, cur)} DKK`;
}
$('newSavingAmount').addEventListener('input', updateSavingConverted);
$('newSavingCurrency').addEventListener('change', () => { syncPreferredCurrency($('newSavingCurrency').value); updateSavingConverted(); });
$('closeSavingsBtn').addEventListener('click', () => hide('savingsModal'));
$('savingsModal').addEventListener('click', (e) => { if (e.target.id === 'savingsModal') hide('savingsModal'); });
$('addSavingInlineBtn').addEventListener('click', openSavingsModal);

$('confirmSavingBtn').addEventListener('click', async () => {
  const entered = parseFloat($('newSavingAmount').value);
  if (!entered || entered <= 0) { alert('Introduce un importe válido.'); return; }
  const cur = $('newSavingCurrency').value || 'DKK';
  const btn = $('confirmSavingBtn');
  btn.disabled = true;
  try {
    await addDoc(collection(db, 'users', currentUser.uid, 'savings'), {
      amount: toDKK(entered, cur),
      originalAmount: entered,
      originalCurrency: cur,
      walletId: $('newSavingWallet').value || '',
      note: $('newSavingNote').value.trim(),
      date: $('newSavingDate').value,
      createdAt: new Date().toISOString()
    });
    hide('savingsModal');
  } catch (err) {
    console.error('Error al guardar ahorro:', err);
    alert('No se pudo guardar el ahorro: ' + err.message);
  } finally {
    btn.disabled = false;
  }
});

async function deleteSaving(id) {
  if (!confirm('¿Borrar este ahorro?')) return;
  await deleteDoc(doc(db, 'users', currentUser.uid, 'savings', id));
}
window.deleteSaving = deleteSaving;

function renderSavings() {
  const total = savings.reduce((s, x) => s + (x.amount || 0), 0);
  $('savingsValue').textContent = total;
  const goal = settings.savingsGoal || 0;
  const wrap = $('savingsGoalWrap');
  if (goal > 0) {
    wrap.classList.remove('hidden');
    const pct = Math.min(100, total / goal * 100);
    $('savingsFill').style.width = pct + '%';
    $('savingsGoalText').textContent = `${total} de ${goal} DKK`;
    $('savingsPct').textContent = Math.round(pct) + '%';
    $('savingsLabel').textContent = total >= goal ? '¡Meta alcanzada! 🎉' : 'Total ahorrado';
  } else {
    wrap.classList.add('hidden');
    $('savingsLabel').textContent = 'Total ahorrado';
  }
  $('savingsCount').textContent = `${savings.length} ${savings.length === 1 ? 'aporte' : 'aportes'}`;
  renderWallets();
  const list = $('savingsList');
  if (savings.length === 0) {
    list.innerHTML = `<div class="bg-slate-900 rounded-2xl p-10 border border-slate-800 text-center"><p class="text-slate-400 text-sm">Sin ahorros aún. Pulsa "Añadir ahorro" arriba para registrar tu primer aporte.</p></div>`;
    return;
  }
  list.innerHTML = savings.map(s => {
    const w = walletById(s.walletId);
    const walletTag = w ? `${w.emoji} ${escapeHtml(w.name)}` : 'General';
    return `
    <div class="bg-slate-900 rounded-2xl p-4 border border-slate-800 flex items-center gap-3">
      <div class="w-10 h-10 rounded-full bg-emerald-500/15 flex items-center justify-center shrink-0">
        <svg class="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.281m5.94 2.28l-2.28 5.941"/></svg>
      </div>
      <div class="flex-1 min-w-0">
        <p class="text-white text-sm font-medium truncate">${walletTag}${s.note ? ` · <span class="text-slate-400 font-normal">${escapeHtml(s.note)}</span>` : ''}</p>
        <p class="text-slate-500 text-xs mt-0.5 font-mono">${new Date(s.date).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}${origLabel(s)}</p>
      </div>
      <span class="font-mono text-emerald-400 shrink-0">+${s.amount} kr</span>
      <button onclick="deleteSaving('${s.id}')" class="shrink-0 w-9 h-9 rounded-full hover:bg-red-950 flex items-center justify-center transition group" aria-label="Borrar">
        <svg class="w-4 h-4 text-slate-500 group-hover:text-red-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"/></svg>
      </button>
    </div>`;
  }).join('');
}

function renderExpenses() {
  const ym = new Date().toISOString().slice(0, 7); // "AAAA-MM"
  const monthExp = expenses.filter(e => (e.date || '').startsWith(ym));
  const variableSpent = monthExp.reduce((s, e) => s + (e.amount || 0), 0);
  const fixedSpent = fixedExpenses.reduce((s, f) => s + (f.amount || 0), 0);
  const spent = variableSpent + fixedSpent;
  const budget = settings.monthlyBudget || 0;
  const remaining = budget - spent;
  const pct = budget > 0 ? Math.min(100, (spent / budget) * 100) : 0;
  const over = budget > 0 && spent > budget;

  // Hero
  const bv = $('budgetValue'), bl = $('budgetLabel'), bf = $('budgetFill');
  if (budget > 0) {
    bl.textContent = over ? 'Excedido este mes' : 'Disponible este mes';
    bv.textContent = remaining;
    bv.className = `font-mono text-5xl ${over ? 'text-red-400' : 'text-emerald-400'}`;
    bf.className = `progress-bar h-full ${over ? 'bg-red-400' : (pct > 80 ? 'bg-amber-400' : 'bg-emerald-400')}`;
    $('budgetSpentText').textContent = `${spent} de ${budget} DKK`;
  } else {
    bl.textContent = 'Gastado este mes';
    bv.textContent = spent;
    bv.className = 'font-mono text-5xl text-sky-400';
    bf.className = 'progress-bar h-full bg-sky-400';
    $('budgetSpentText').textContent = `${spent} DKK · sin presupuesto`;
  }
  bv.style.fontWeight = 500;
  bf.style.width = pct + '%';
  $('budgetPct').textContent = Math.round(pct) + '%';

  // Desglose
  $('dsBudget').textContent = budget > 0 ? `${budget} kr` : '— sin límite';
  $('dsFixed').textContent = `${fixedSpent} kr`;
  $('dsVariable').textContent = `${variableSpent} kr`;
  $('dsSpent').textContent = `${spent} kr`;
  const dsRem = $('dsRemaining');
  if (budget > 0) {
    dsRem.textContent = `${remaining} kr`;
    dsRem.className = `font-mono font-medium ${over ? 'text-red-400' : 'text-emerald-400'}`;
  } else {
    dsRem.textContent = '—';
    dsRem.className = 'font-mono font-medium text-slate-500';
  }

  // Por categoría (mes actual: variables + fijos)
  const byCat = {};
  monthExp.forEach(e => { byCat[e.category] = (byCat[e.category] || 0) + e.amount; });
  fixedExpenses.forEach(f => { byCat[f.category] = (byCat[f.category] || 0) + f.amount; });
  const cats = Object.entries(byCat).sort((a, b) => b[1] - a[1]);
  const bd = $('categoryBreakdown');
  if (cats.length === 0) {
    bd.innerHTML = '<p class="text-slate-500 text-sm">Sin gastos este mes.</p>';
  } else {
    bd.innerHTML = cats.map(([id, amt]) => {
      const c = catById(id);
      const p = spent > 0 ? (amt / spent * 100) : 0;
      return `
      <div>
        <div class="flex justify-between items-center mb-1">
          <span class="text-sm text-white">${c.emoji} ${c.label}</span>
          <span class="font-mono text-sm text-slate-300">${amt} kr</span>
        </div>
        <div class="h-1.5 rounded-full bg-slate-800 overflow-hidden">
          <div class="h-full rounded-full progress-bar" style="width:${p}%; background-color:${c.color};"></div>
        </div>
      </div>`;
    }).join('');
  }

  // Historial (gastos variables registrados)
  $('expHistoryCount').textContent = `${expenses.length} ${expenses.length === 1 ? 'gasto' : 'gastos'} en total`;
  const list = $('expensesList');
  if (expenses.length === 0) {
    list.innerHTML = `<div class="bg-slate-900 rounded-2xl p-10 border border-slate-800 text-center"><p class="text-slate-400 text-sm">Sin gastos. Pulsa + para añadir.</p></div>`;
  } else {
    list.innerHTML = expenses.map(e => {
      const c = catById(e.category);
      return `
      <div class="bg-slate-900 rounded-2xl p-4 border border-slate-800 flex items-center gap-3">
        <div class="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style="background-color:${c.color}22;">
          <span class="text-lg">${c.emoji}</span>
        </div>
        <div class="flex-1 min-w-0">
          <p class="text-white text-sm font-medium truncate">${c.label}${e.note ? ` · <span class="text-slate-400 font-normal">${escapeHtml(e.note)}</span>` : ''}</p>
          <p class="text-slate-500 text-xs mt-0.5 font-mono">${new Date(e.date).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}${origLabel(e)}</p>
        </div>
        <span class="font-mono text-white shrink-0">${e.amount} kr</span>
        <button onclick="deleteExpense('${e.id}')" class="shrink-0 w-9 h-9 rounded-full hover:bg-red-950 flex items-center justify-center transition group" aria-label="Borrar">
          <svg class="w-4 h-4 text-slate-500 group-hover:text-red-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"/></svg>
        </button>
      </div>`;
    }).join('');
  }
}

