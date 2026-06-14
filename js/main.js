// === ARRANQUE ===
// Firebase se carga como módulo en index.html y expone las funciones como
// globales. Cuando está listo, llama a startApp (o startApp se lanza solo si
// Firebase ya estaba listo). Así el orden de carga no importa.
function startApp() {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
  provider = new GoogleAuthProvider();
  initAuth();
}
if (window.__firebaseReady) startApp();
else window.__startApp = startApp;
