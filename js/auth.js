// === AUTENTICACIÓN Y LISTENERS ===
function initAuth() {
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    currentUser = null;
    if (unsubTrips) { unsubTrips(); unsubTrips = null; }
    if (unsubCards) { unsubCards(); unsubCards = null; }
    if (unsubSettings) { unsubSettings(); unsubSettings = null; }
    if (unsubTodos) { unsubTodos(); unsubTodos = null; }
    if (unsubExpenses) { unsubExpenses(); unsubExpenses = null; }
    if (unsubFixed) { unsubFixed(); unsubFixed = null; }
    if (unsubSavings) { unsubSavings(); unsubSavings = null; }
    if (unsubWallets) { unsubWallets(); unsubWallets = null; }
    if (unsubSupermarkets) { unsubSupermarkets(); unsubSupermarkets = null; }
    if (unsubShopping) { unsubShopping(); unsubShopping = null; }
    if (unsubSessions) { unsubSessions(); unsubSessions = null; }
    showScreen('login');
    return;
  }
  if (user.uid !== OWNER_UID) {
    console.warn('UID no autorizado:', user.uid);
    showScreen('denied');
    return;
  }
  currentUser = user;
  showScreen('app');
  attachListeners();
  populateCurrencySelects();
  loadRates();
  setMainView('home');
});
}


$('signInBtn').addEventListener('click', async () => {
  try { await signInWithPopup(auth, provider); }
  catch (e) { alert('Error al iniciar sesión: ' + e.message); }
});
$('signOutBtn').addEventListener('click', () => signOut(auth));
$('signOutDeniedBtn').addEventListener('click', () => signOut(auth));

// === FIRESTORE LISTENERS ===
function attachListeners() {
  const settingsRef = doc(db, 'users', currentUser.uid);
  unsubSettings = onSnapshot(settingsRef, (snap) => {
    if (snap.exists()) {
      settings = { ...settings, ...snap.data() };
    } else {
      setDoc(settingsRef, settings);
    }
    renderSettings();
    render();
    renderExpenses();
    renderSavings();
    renderHome();
  });

  const cardsRef = collection(db, 'users', currentUser.uid, 'cards');
  const cardsQ = query(cardsRef, orderBy('createdAt', 'asc'));
  unsubCards = onSnapshot(cardsQ, (snap) => {
    cards = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    // Si no hay ninguna tarjeta todavía, crea una por defecto (migración suave).
    if (cards.length === 0) { ensureDefaultCard(); return; }
    renderCardTabs();
    render();
    renderHome();
  });

  const tripsRef = collection(db, 'users', currentUser.uid, 'trips');
  const q = query(tripsRef, orderBy('date', 'desc'));
  unsubTrips = onSnapshot(q, (snap) => {
    trips = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderCardTabs();
    render();
    renderHome();
  });

  const todosRef = collection(db, 'users', currentUser.uid, 'todos');
  const todosQ = query(todosRef, orderBy('createdAt', 'desc'));
  unsubTodos = onSnapshot(todosQ, (snap) => {
    todos = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderTodos();
    renderHome();
  });

  const expensesRef = collection(db, 'users', currentUser.uid, 'expenses');
  const expQ = query(expensesRef, orderBy('date', 'desc'));
  unsubExpenses = onSnapshot(expQ, (snap) => {
    expenses = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderExpenses();
    renderHome();
  });

  const fixedRef = collection(db, 'users', currentUser.uid, 'fixedExpenses');
  const fixedQ = query(fixedRef, orderBy('createdAt', 'desc'));
  unsubFixed = onSnapshot(fixedQ, (snap) => {
    fixedExpenses = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderExpenses();
    renderFixed();
    renderHome();
  });

  const savingsRef = collection(db, 'users', currentUser.uid, 'savings');
  const savingsQ = query(savingsRef, orderBy('date', 'desc'));
  unsubSavings = onSnapshot(savingsQ, (snap) => {
    savings = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderSavings();
    renderHome();
  });

  const walletsRef = collection(db, 'users', currentUser.uid, 'wallets');
  const walletsQ = query(walletsRef, orderBy('createdAt', 'asc'));
  unsubWallets = onSnapshot(walletsQ, (snap) => {
    wallets = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderSavings();
  });

  const supermarketsRef = collection(db, 'users', currentUser.uid, 'supermarkets');
  const supermarketsQ = query(supermarketsRef, orderBy('createdAt', 'asc'));
  unsubSupermarkets = onSnapshot(supermarketsQ, (snap) => {
    supermarkets = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderShopping();
  });

  const shoppingRef = collection(db, 'users', currentUser.uid, 'shopping');
  const shoppingQ = query(shoppingRef, orderBy('createdAt', 'asc'));
  unsubShopping = onSnapshot(shoppingQ, (snap) => {
    shopping = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderShopping();
    renderHome();
  });

  const sessionsRef = collection(db, 'users', currentUser.uid, 'sessions');
  const sessionsQ = query(sessionsRef, orderBy('date', 'desc'));
  unsubSessions = onSnapshot(sessionsQ, (snap) => {
    sessions = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderGym();
    renderHome();
  });
}
