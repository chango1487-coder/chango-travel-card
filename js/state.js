// === ESTADO GLOBAL Y HELPERS ===
// ============================================================
//   CONFIGURACIÓN
// ============================================================
const firebaseConfig = {
  apiKey: "AIzaSyAXOy_ErjZkjCQsbE9a7ZPABfA25Gj0MVs",
  authDomain: "travel-card-134e8.firebaseapp.com",
  projectId: "travel-card-134e8",
  storageBucket: "travel-card-134e8.firebasestorage.app",
  messagingSenderId: "1052812887819",
  appId: "1:1052812887819:web:12d8a32c8c9aa80f77840e"
};

const OWNER_UID = "7aeg8ki8WHPuu4EH9lZYUnGDWKr1";
// ============================================================

let app, auth, db, provider;

let currentUser = null;
// Los parámetros de la tarjeta (coste, billete, fechas) viven ahora en cada
// documento de la colección `cards`, no aquí. Settings solo guarda presupuesto/ahorro.
let settings = { monthlyBudget: 0, savingsGoal: 0 };
let trips = [];
let cards = [];
let activeCardId = null;
let creatingDefaultCard = false;
let todos = [];
let expenses = [];
let fixedExpenses = [];
let savings = [];
let wallets = [];
let supermarkets = [];
let shopping = [];
let sessions = [];
let unsubTrips = null;
let unsubCards = null;
let unsubSettings = null;
let unsubTodos = null;
let unsubExpenses = null;
let unsubFixed = null;
let unsubSavings = null;
let unsubWallets = null;
let unsubSupermarkets = null;
let unsubShopping = null;
let unsubSessions = null;

const $ = (id) => document.getElementById(id);
const show = (id) => $(id).classList.remove('hidden');
const hide = (id) => $(id).classList.add('hidden');

function showScreen(name) {
  ['loading','login','denied','app'].forEach(hide);
  show(name);
}
