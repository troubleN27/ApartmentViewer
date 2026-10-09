// Экраны (шахматка → планировка → 3D) и общее состояние.
import * as storage from './storage.js';
import * as api from './api.js';
import { initLang, getLang, setLang, applyI18n, onLangChange } from './i18n.js';
import { createChess, DEFAULT_FILTERS } from './chess.js';

const $ = (id) => document.getElementById(id);

const state = {
  view: 'home',
  apartments: [],
  current: null,
  filters: DEFAULT_FILTERS,
  favorites: [],
};

/* ---------- Экраны ---------- */

function showView(view) {
  state.view = view;
  $('view-home').hidden = view !== 'home';
  $('view-plan').hidden = view !== 'plan';
  storage.set('lastView', view);
  window.scrollTo(0, 0);
}

function goHome(toChess) {
  if (state.view !== 'home') showView('home');
  if (toChess) $('chess').scrollIntoView();
}

/* ---------- Шахматка ---------- */

const chess = createChess({
  grid: $('chess-grid'),
  filtersEl: $('filters'),
  legendEl: $('legend'),
  statusEl: $('chess-status'),
  tooltip: $('chess-tooltip'),
  onSelect: (id) => openApartment(id),
  onToggleFav: (id) => toggleFavorite(id),
  onFilters: (filters) => {
    state.filters = filters;
    storage.set('filters', filters);
  },
});

function toggleFavorite(id) {
  const has = state.favorites.includes(id);
  state.favorites = has ? state.favorites.filter((f) => f !== id) : [...state.favorites, id];
  storage.set('favorites', state.favorites);
  chess.setState({ favorites: state.favorites });
}

async function loadApartments() {
  try {
    state.apartments = await api.getApartments();
    chess.setData(state.apartments);
    $('stat-floors').textContent = new Set(state.apartments.map((a) => a.floor)).size;
    $('stat-apartments').textContent = state.apartments.length;
  } catch {
    chess.setMessage('chess.error');
  }
}

/* ---------- Планировка ---------- */

function openApartment(id) {
  storage.set('selectedId', id);
}

/* ---------- Шапка, язык ---------- */

function initLangSwitch() {
  const buttons = document.querySelectorAll('[data-lang]');
  const mark = () => buttons.forEach((b) => b.classList.toggle('is-active', b.dataset.lang === getLang()));
  buttons.forEach((b) => b.addEventListener('click', () => setLang(b.dataset.lang)));
  onLangChange(mark);
  mark();
}

const actions = {
  home: () => goHome(false),
  'to-chess': () => goHome(true),
};

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action]');
  if (el && actions[el.dataset.action]) actions[el.dataset.action](el);
});

/* ---------- Запуск ---------- */

storage.init();
initLang();
applyI18n();
initLangSwitch();
onLangChange(() => chess.render());

state.filters = { ...DEFAULT_FILTERS, ...storage.get('filters', {}) };
state.favorites = storage.get('favorites', []);
chess.setState({ filters: state.filters, favorites: state.favorites });

loadApartments();
