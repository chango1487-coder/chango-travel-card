// === TODOS ===
async function addTodoFromInput() {
  const input = $('newTodoInput');
  const dueInput = $('newTodoDueDate');
  const text = input.value.trim();
  if (!text) return;
  const payload = { text, done: false, createdAt: new Date().toISOString() };
  if (dueInput.value) payload.dueDate = dueInput.value;
  await addDoc(collection(db, 'users', currentUser.uid, 'todos'), payload);
  input.value = '';
  dueInput.value = '';
  $('clearDueDateBtn').classList.add('hidden');
  input.focus();
}
$('addTodoBtn').addEventListener('click', addTodoFromInput);
$('newTodoInput').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') addTodoFromInput();
});
$('newTodoDueDate').addEventListener('change', () => {
  $('clearDueDateBtn').classList.toggle('hidden', !$('newTodoDueDate').value);
});
$('clearDueDateBtn').addEventListener('click', () => {
  $('newTodoDueDate').value = '';
  $('clearDueDateBtn').classList.add('hidden');
});

async function toggleTodo(id) {
  const t = todos.find(x => x.id === id);
  if (!t) return;
  await setDoc(doc(db, 'users', currentUser.uid, 'todos', id), { done: !t.done }, { merge: true });
}
window.toggleTodo = toggleTodo;

async function deleteTodo(id) {
  await deleteDoc(doc(db, 'users', currentUser.uid, 'todos', id));
}
window.deleteTodo = deleteTodo;


// === SÚPER (listas de la compra por supermercado) ===
let selectedSupermarketId = null;
let editingShopId = null;

function openSupermarketModal() {
  $('newSupermarketName').value = '';
  show('supermarketModal');
  setTimeout(() => $('newSupermarketName').focus(), 50);
}
$('closeSupermarketBtn').addEventListener('click', () => hide('supermarketModal'));
$('supermarketModal').addEventListener('click', (e) => { if (e.target.id === 'supermarketModal') hide('supermarketModal'); });

$('confirmSupermarketBtn').addEventListener('click', async () => {
  const name = $('newSupermarketName').value.trim();
  if (!name) { alert('Ponle un nombre al supermercado.'); return; }
  const btn = $('confirmSupermarketBtn');
  btn.disabled = true;
  try {
    const ref = await addDoc(collection(db, 'users', currentUser.uid, 'supermarkets'), {
      name, createdAt: new Date().toISOString()
    });
    selectedSupermarketId = ref.id;
    hide('supermarketModal');
  } catch (err) {
    console.error('Error al crear supermercado:', err);
    alert('No se pudo crear el supermercado: ' + err.message);
  } finally {
    btn.disabled = false;
  }
});

async function deleteSupermarket(id) {
  const sm = supermarkets.find(s => s.id === id);
  if (!sm) return;
  if (!confirm(`¿Borrar "${sm.name}" y todos sus productos?`)) return;
  const items = shopping.filter(i => i.supermarketId === id);
  await Promise.all(items.map(i => deleteDoc(doc(db, 'users', currentUser.uid, 'shopping', i.id))));
  await deleteDoc(doc(db, 'users', currentUser.uid, 'supermarkets', id));
  selectedSupermarketId = null;
}
$('deleteSupermarketBtn').addEventListener('click', () => { if (selectedSupermarketId) deleteSupermarket(selectedSupermarketId); });

async function addShopItem() {
  const name = $('newShopName').value.trim();
  const qty = $('newShopQty').value.trim();
  if (!name || !selectedSupermarketId) return;
  await addDoc(collection(db, 'users', currentUser.uid, 'shopping'), {
    name, qty, done: false, supermarketId: selectedSupermarketId, createdAt: new Date().toISOString()
  });
  $('newShopName').value = '';
  $('newShopQty').value = '';
  $('newShopName').focus();
}
$('addShopBtn').addEventListener('click', addShopItem);
$('newShopName').addEventListener('keydown', (e) => { if (e.key === 'Enter') addShopItem(); });
$('newShopQty').addEventListener('keydown', (e) => { if (e.key === 'Enter') addShopItem(); });

async function toggleShopItem(id) {
  const it = shopping.find(x => x.id === id);
  if (!it) return;
  await setDoc(doc(db, 'users', currentUser.uid, 'shopping', id), { done: !it.done }, { merge: true });
}
window.toggleShopItem = toggleShopItem;

async function deleteShopItem(id) {
  await deleteDoc(doc(db, 'users', currentUser.uid, 'shopping', id));
}
window.deleteShopItem = deleteShopItem;

function startEditShop(id) { editingShopId = id; renderShopping(); }
window.startEditShop = startEditShop;

async function saveEditShop(id) {
  const nameEl = $('editShopName_' + id);
  const qtyEl = $('editShopQty_' + id);
  if (!nameEl) { editingShopId = null; renderShopping(); return; }
  const name = nameEl.value.trim();
  const qty = qtyEl ? qtyEl.value.trim() : '';
  editingShopId = null;
  if (name) {
    await setDoc(doc(db, 'users', currentUser.uid, 'shopping', id), { name, qty }, { merge: true });
  } else {
    renderShopping();
  }
}
window.saveEditShop = saveEditShop;

function selectSupermarket(id) { selectedSupermarketId = id; editingShopId = null; renderShopping(); }
window.selectSupermarket = selectSupermarket;

function renderShopping() {
  const tabs = $('supermarketTabs');
  // Asegurar selección válida
  if (!selectedSupermarketId || !supermarkets.find(s => s.id === selectedSupermarketId)) {
    selectedSupermarketId = supermarkets.length ? supermarkets[0].id : null;
  }
  // Pills de supermercados + botón nuevo
  tabs.innerHTML = supermarkets.map(s => {
    const active = s.id === selectedSupermarketId;
    return `<button onclick="selectSupermarket('${s.id}')" class="shrink-0 px-4 py-2 rounded-full text-sm font-medium transition ${active ? 'bg-sky-500 text-white' : 'bg-slate-900 text-slate-400 border border-slate-800'}">${escapeHtml(s.name)}</button>`;
  }).join('') + `<button id="newSupermarketPill" class="shrink-0 px-4 py-2 rounded-full text-sm font-medium bg-slate-900 text-sky-400 border border-slate-800 hover:border-sky-500 transition">+ Nuevo</button>`;
  $('newSupermarketPill').addEventListener('click', openSupermarketModal);

  const empty = $('superEmpty');
  const content = $('superContent');
  if (!selectedSupermarketId) {
    empty.classList.remove('hidden');
    content.classList.add('hidden');
    return;
  }
  empty.classList.add('hidden');
  content.classList.remove('hidden');

  const items = shopping.filter(i => i.supermarketId === selectedSupermarketId);
  const pending = items.filter(i => !i.done);
  const done = items.filter(i => i.done);
  $('shopStats').textContent = `${pending.length} ${pending.length === 1 ? 'pendiente' : 'pendientes'} · ${done.length} en carrito`;

  const list = $('shopList');
  if (items.length === 0) {
    list.innerHTML = `<div class="bg-slate-900 rounded-2xl p-10 border border-slate-800 text-center"><p class="text-slate-400 text-sm">Lista vacía. Añade productos arriba.</p></div>`;
    return;
  }

  const renderItem = (it) => {
    if (it.id === editingShopId) {
      return `
      <div class="bg-slate-900 rounded-2xl p-3 border border-sky-500 flex items-center gap-2">
        <input id="editShopName_${it.id}" value="${escapeHtml(it.name)}" class="flex-1 min-w-0 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white outline-none focus:border-sky-500" />
        <input id="editShopQty_${it.id}" value="${escapeHtml(it.qty || '')}" placeholder="Cant." class="w-14 bg-slate-950 border border-slate-800 rounded-lg px-2 py-2 text-white text-center text-sm outline-none focus:border-sky-500" />
        <button onclick="saveEditShop('${it.id}')" class="shrink-0 w-9 h-9 rounded-full bg-sky-500 hover:bg-sky-400 flex items-center justify-center transition" aria-label="Guardar">
          <svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5"/></svg>
        </button>
      </div>`;
    }
    return `
    <div class="bg-slate-900 rounded-xl py-2 px-3 border border-slate-800 flex items-center gap-3">
      <button onclick="toggleShopItem('${it.id}')" class="shrink-0 w-6 h-6 rounded-full border-2 ${it.done ? 'bg-sky-500 border-sky-500' : 'border-slate-700 hover:border-sky-400'} flex items-center justify-center transition" aria-label="Marcar">
        ${it.done ? '<svg class="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" stroke-width="3" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5"/></svg>' : ''}
      </button>
      <p class="flex-1 text-sm ${it.done ? 'text-slate-500 line-through' : 'text-white'} truncate">${escapeHtml(it.name)}${it.qty ? ` <span class="text-slate-500">×${escapeHtml(it.qty)}</span>` : ''}</p>
      <button onclick="startEditShop('${it.id}')" class="shrink-0 w-8 h-8 rounded-full hover:bg-slate-800 flex items-center justify-center transition" aria-label="Editar">
        <svg class="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125"/></svg>
      </button>
      <button onclick="deleteShopItem('${it.id}')" class="shrink-0 w-8 h-8 rounded-full hover:bg-red-950 flex items-center justify-center transition group" aria-label="Borrar">
        <svg class="w-4 h-4 text-slate-500 group-hover:text-red-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
      </button>
    </div>`;
  };
  list.innerHTML = pending.map(renderItem).join('')
    + (done.length > 0 && pending.length > 0 ? '<div class="h-1"></div>' : '')
    + done.map(renderItem).join('');

  // Autofocus al editar
  if (editingShopId && $('editShopName_' + editingShopId)) {
    const el = $('editShopName_' + editingShopId);
    el.focus();
    el.addEventListener('keydown', (e) => { if (e.key === 'Enter') saveEditShop(editingShopId); });
  }
}


function dueLabelAndClass(dueDate, done) {
  if (!dueDate) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dueDate);
  due.setHours(0, 0, 0, 0);
  const diff = Math.round((due - today) / 86400000);
  const fmt = due.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
  if (done) return { label: fmt, cls: 'text-slate-600' };
  if (diff < 0) return { label: `Atrasada · ${fmt}`, cls: 'text-red-400' };
  if (diff === 0) return { label: `Hoy · ${fmt}`, cls: 'text-amber-400' };
  if (diff === 1) return { label: `Mañana · ${fmt}`, cls: 'text-amber-400' };
  if (diff <= 7) return { label: `En ${diff} días · ${fmt}`, cls: 'text-sky-400' };
  return { label: fmt, cls: 'text-slate-500' };
}

function renderTodos() {
  // Pendientes ordenadas: atrasadas/próximas primero, sin fecha al final
  const pending = todos.filter(t => !t.done).sort((a, b) => {
    if (!a.dueDate && !b.dueDate) return 0;
    if (!a.dueDate) return 1;
    if (!b.dueDate) return -1;
    return a.dueDate.localeCompare(b.dueDate);
  });
  const done = todos.filter(t => t.done);
  $('todoStats').textContent = `${pending.length} ${pending.length === 1 ? 'pendiente' : 'pendientes'} · ${done.length} ${done.length === 1 ? 'hecha' : 'hechas'}`;
  const list = $('todosList');
  if (todos.length === 0) {
    list.innerHTML = `
      <div class="bg-slate-900 rounded-2xl p-10 border border-slate-800 text-center">
        <p class="text-slate-400 text-sm">Sin tareas. Añade una arriba.</p>
      </div>`;
    return;
  }
  const renderItem = (t) => {
    const due = dueLabelAndClass(t.dueDate, t.done);
    return `
    <div class="bg-slate-900 rounded-2xl p-4 border border-slate-800 flex items-center gap-3">
      <button onclick="toggleTodo('${t.id}')" class="shrink-0 w-6 h-6 rounded-full border-2 ${t.done ? 'bg-sky-500 border-sky-500' : 'border-slate-700 hover:border-sky-400'} flex items-center justify-center transition" aria-label="Marcar">
        ${t.done ? '<svg class="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" stroke-width="3" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5"/></svg>' : ''}
      </button>
      <div class="flex-1 min-w-0">
        <p class="text-sm ${t.done ? 'text-slate-500 line-through' : 'text-white'} truncate">${escapeHtml(t.text)}</p>
        ${due ? `<p class="text-xs mt-0.5 ${due.cls} font-mono">${due.label}</p>` : ''}
      </div>
      <button onclick="deleteTodo('${t.id}')" class="shrink-0 w-9 h-9 rounded-full hover:bg-red-950 flex items-center justify-center transition group" aria-label="Borrar">
        <svg class="w-4 h-4 text-slate-500 group-hover:text-red-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"/></svg>
      </button>
    </div>`;
  };
  list.innerHTML = pending.map(renderItem).join('')
    + (done.length > 0 && pending.length > 0 ? '<div class="h-2"></div>' : '')
    + done.map(renderItem).join('');
}
