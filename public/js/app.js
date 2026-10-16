// Экраны (шахматка → планировка → 3D) и общее состояние.
import * as storage from './storage.js';
import * as api from './api.js';
import { initLang, getLang, setLang, applyI18n, onLangChange, t } from './i18n.js';
import { createChess, DEFAULT_FILTERS, STAR_ICON } from './chess.js';
import { createPlanView, ROOM_COLORS } from './plan2d.js';
import { createFurnishEditor } from './furnish.js';
import { autoFurnish, sanitizeFurniture } from './furniture.js';
import { planArea, roomArea, roomAt, calcPrice, formatArea, formatPrice, validatePlan } from './model.js';

const $ = (id) => document.getElementById(id);
const PHONE_RE = /^\+998\d{9}$/;
const EYE_OFFSET = 12; // глаза ниже макушки, см

const state = {
  view: 'home',
  apartments: [],
  current: null, // открытая квартира целиком
  planOk: false,
  planMessage: null, // { key } | { errors }
  filters: DEFAULT_FILTERS,
  favorites: [],
  furniture: [], // обстановка открытой квартиры
};

/* ---------- Экраны ---------- */

function showView(view) {
  state.view = view;
  $('view-home').hidden = view !== 'home';
  $('view-plan').hidden = view !== 'plan';
  storage.set('lastView', view);
  window.scrollTo(0, 0);
  updateTitle();
}

// Заголовок вкладки: открытая квартира или название ЖК.
function updateTitle() {
  const apt = state.view === 'plan' && state.current;
  document.title = apt ? `${aptTitle(apt)} — ${t('brand')}` : t('meta.title');
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
  if (state.current?.id === id) renderCard();
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

const planView = createPlanView($('plan-canvas'), { tooltip: $('plan-tooltip') });
const isDev = (apt) => apt.id.startsWith('DEV-');

/* ---------- Обстановка ---------- */

const editor = createFurnishEditor({
  planView,
  canvas: $('plan-canvas'),
  tools: $('plan-tools'),
  catalog: $('catalog'),
  getPlan: () => (state.planOk ? state.current.plan : null),
  getItems: () => state.furniture,
  onChange: setFurniture,
  onRandom: randomFurnish,
});

// Обстановка хранится по id квартиры и показывается на плане, мини-карте и в 3D.
function setFurniture(items) {
  if (!state.planOk) return;
  state.furniture = items;
  const all = storage.get('furniture', {});
  if (items.length) all[state.current.id] = items;
  else delete all[state.current.id];
  storage.set('furniture', all);
  planView.setFurniture(items);
  view3d.viewer?.setFurniture(items);
  view3d.minimap?.setFurniture(items);
  editor.refresh();
  view3d.editor?.refresh();
}

function randomFurnish() {
  if (!state.planOk) return;
  setFurniture(autoFurnish(state.current.plan, 1 + Math.floor(Math.random() * 1e9)));
  editor.refresh();
}

async function openApartment(id) {
  storage.set('selectedId', id);
  showView('plan');
  editor.setEnabled(false);
  state.current = null;
  state.planOk = false;
  state.planMessage = { key: 'plan.loading' };
  renderApartment();
  try {
    state.current = id.startsWith('DEV-')
      ? storage.get('devApartments', []).find((a) => a.id === id) || null
      : await api.getApartment(id);
  } catch {
    state.current = null;
  }
  if (storage.get('selectedId') !== id) return; // пока грузили, выбрали другую
  if (!state.current) {
    state.planMessage = { key: 'plan.notFound' };
  } else {
    const check = validatePlan(state.current.plan);
    state.planOk = check.ok;
    state.planMessage = check.ok ? null : { errors: check.errors };
  }
  renderApartment();
}

function renderApartment() {
  const box = $('plan-message');
  const msg = state.planMessage;
  box.hidden = !msg;
  box.classList.toggle('is-error', Boolean(msg?.errors));
  if (msg?.errors) {
    const codes = [...new Set(msg.errors.map((e) => e.code))];
    box.innerHTML = `<strong>${t('plan.invalid')}</strong><ul>${codes.map((c) => `<li>${t(`err.${c}`)}</li>`).join('')}</ul>`;
  } else if (msg) {
    box.textContent = t(msg.key);
  }
  planView.setPlan(state.planOk ? state.current.plan : null);
  state.furniture = state.planOk ? sanitizeFurniture(state.current.plan, storage.get('furniture', {})[state.current.id]) : [];
  editor.refresh();
  renderCard();
  updateTitle();
}

function renderCard() {
  const card = $('apt-card');
  const apt = state.current;
  card.hidden = !apt;
  if (!apt) return;
  const dev = isDev(apt);
  const fav = state.favorites.includes(apt.id);
  const facts = [[t('plan.status'), `<span class="status-badge status-${apt.status}">${t(`status.${apt.status}`)}</span>`]];
  let price = '';
  let rooms = '';
  if (state.planOk) {
    const area = planArea(apt.plan);
    price = `<p class="apt-price">${formatPrice(calcPrice(area, apt.pricePerM2))} <small>${t('unit.sum')}</small></p>`;
    facts.unshift(
      [t('plan.area'), `${formatArea(area)} ${t('unit.m2')}`],
      [t('plan.pricePerM2'), `${formatPrice(apt.pricePerM2)} ${t('unit.sum')}`],
      [t('plan.ceiling'), `${apt.plan.height} ${t('unit.cm')}`],
    );
    rooms = `
      <p class="apt-rooms-title">${t('plan.rooms')}</p>
      <ul class="apt-rooms">${apt.plan.rooms
        .map(
          (r) =>
            `<li><span><i style="background:${ROOM_COLORS[r.type]}"></i>${t(`room.${r.type}`)}</span><span>${formatArea(roomArea(r))} ${t('unit.m2')}</span></li>`,
        )
        .join('')}</ul>`;
  }
  const note = dev ? t('plan.devNote', { n: apt.seed }) : apt.status === 'sold' ? t('plan.sold') : '';
  card.innerHTML = `
    <div class="apt-head">
      <div>
        <p class="eyebrow">${t('rooms.full', { n: apt.rooms })}</p>
        <h2 class="apt-title">${t('plan.apartment', { n: apt.number })}</h2>
        <p class="apt-sub">${t('plan.floor', { n: apt.floor })} · ${apt.id}</p>
      </div>
      ${dev ? '' : `<button class="apt-fav${fav ? ' is-active' : ''}" data-action="fav" aria-pressed="${fav}" aria-label="${t(fav ? 'fav.remove' : 'fav.add')}">${STAR_ICON}</button>`}
    </div>
    ${price}
    <dl class="apt-facts">${facts.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl>
    ${rooms}
    <div class="apt-actions">
      <button class="btn btn-dark" data-action="open-3d" ${state.planOk ? '' : 'disabled'}>${t('plan.view3d')}</button>
      <button class="btn btn-outline" data-action="open-lead" ${dev || apt.status === 'sold' ? 'disabled' : ''}>${t('plan.lead')}</button>
    </div>
    ${note ? `<p class="apt-note">${note}</p>` : ''}`;
}

const aptTitle = (apt) => `${t('plan.apartment', { n: apt.number })} · ${t('plan.floor', { n: apt.floor })}`;

/* ---------- Модальные окна ---------- */

function openModal(modal) {
  modal.hidden = false;
  modal.querySelector('input')?.focus();
}

function closeModals() {
  let closed = false;
  document.querySelectorAll('.modal:not([hidden])').forEach((m) => {
    m.hidden = true;
    closed = true;
  });
  return closed;
}

document.querySelectorAll('.modal [data-close]').forEach((el) => el.addEventListener('click', closeModals));

/* ---------- 3D ---------- */

const view3d = {
  open: false,
  viewer: null,
  mode: 'orbit',
  minimap: null,
  keepOnFsExit: false, // выход из полноэкранного режима не должен закрывать сцену
  room: null,
  locked: false,
  editor: null, // редактор обстановки в 3D
};

function updateHud() {
  if (!view3d.open || !state.current) return;
  const apt = state.current;
  const walking = view3d.mode === 'walk';
  $('hud-title').textContent = aptTitle(apt);
  const room = walking && view3d.room;
  $('hud-sub').textContent = room
    ? `${t(`room.${room.type}`)} · ${formatArea(roomArea(room))} ${t('unit.m2')}`
    : `${t('rooms.full', { n: apt.rooms })} · ${formatArea(planArea(apt.plan))} ${t('unit.m2')}`;
  $('hud-hint').textContent = t(!walking ? 'v3d.hintOrbit' : view3d.locked ? 'v3d.hintWalk' : 'v3d.clickToLook');
  $('minimap').hidden = !walking;
  $('crosshair').hidden = !walking;
  $('view-3d').classList.toggle('is-walk', walking);
  const finish = storage.get('finish', 'finish');
  document.querySelectorAll('#seg-mode button').forEach((b) => b.classList.toggle('is-active', b.dataset.mode === view3d.mode));
  document.querySelectorAll('#seg-finish button').forEach((b) => b.classList.toggle('is-active', b.dataset.finish === finish));
}

async function open3d() {
  if (!state.planOk || view3d.open) return;
  view3d.open = true;
  view3d.mode = 'orbit';
  view3d.room = null;
  $('view-3d').hidden = false;
  document.body.style.overflow = 'hidden';
  storage.set('lastView', '3d');
  // Полноэкранный режим просим у всего документа, чтобы поверх сцены работали модальные окна.
  document.documentElement.requestFullscreen?.().catch(() => {});
  updateHud();

  const { createViewer } = await import('./scene3d.js');
  if (!view3d.open) return;
  const { plan } = state.current;
  view3d.minimap = createPlanView($('minimap-canvas'), { minimap: true });
  view3d.minimap.setPlan(plan);
  view3d.minimap.setFurniture(state.furniture);
  view3d.viewer = createViewer({
    container: $('view3d-canvas'),
    plan,
    finish: storage.get('finish', 'finish'),
    furniture: state.furniture,
    labelOf: (room) => [t(`room.${room.type}`), `${formatArea(roomArea(room))} ${t('unit.m2')}`],
    onPlayer(player) {
      view3d.minimap?.setPlayer(player);
      const room = roomAt(plan, player.x, player.y);
      if (room !== view3d.room) {
        view3d.room = room;
        updateHud();
      }
    },
    onLock(locked) {
      view3d.locked = locked;
      updateHud();
    },
    onModeChange(mode) {
      view3d.mode = mode;
      view3d.room = null;
      updateHud();
      if (mode === 'walk') view3d.minimap?.draw();
    },
  });
  // Тот же редактор, что и на плане, но поверх 3D-сцены.
  view3d.editor = createFurnishEditor({
    planView: view3d.viewer.editing,
    canvas: view3d.viewer.domElement,
    tools: $('hud-tools'),
    catalog: $('hud-catalog'),
    getPlan: () => plan,
    getItems: () => state.furniture,
    onChange: setFurniture,
    onRandom: randomFurnish,
    hintKey: 'furn.hint3d',
    capture: true,
  });
  view3d.editor.refresh();
}

function close3d() {
  if (!view3d.open) return;
  view3d.open = false;
  view3d.editor?.destroy();
  view3d.editor = null;
  view3d.viewer?.dispose();
  view3d.viewer = null;
  view3d.minimap?.destroy();
  view3d.minimap = null;
  closeModals();
  $('view-3d').hidden = true;
  document.body.style.overflow = '';
  if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  storage.set('lastView', 'plan');
  planView.draw();
}

function toggleFullscreen() {
  if (document.fullscreenElement) {
    view3d.keepOnFsExit = true;
    document.exitFullscreen().catch(() => {});
  } else {
    document.documentElement.requestFullscreen?.().catch(() => {});
  }
}

function setMode(mode) {
  if (!view3d.viewer || mode === view3d.mode) return;
  if (mode === 'orbit') return view3d.viewer.setMode('orbit');
  view3d.editor?.setEnabled(false);
  // Прогулка не запускается без роста.
  $('height-input').value = storage.get('userHeight') ?? '';
  $('height-error').hidden = true;
  openModal($('modal-height'));
}

$('height-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const height = Number($('height-input').value);
  if (!Number.isInteger(height) || height < 120 || height > 220) {
    $('height-error').hidden = false;
    return;
  }
  storage.set('userHeight', height);
  closeModals();
  view3d.viewer?.setMode('walk', { eyeHeight: height - EYE_OFFSET });
});

$('seg-mode').addEventListener('click', (e) => {
  const btn = e.target.closest('[data-mode]');
  if (btn) setMode(btn.dataset.mode);
});

$('seg-finish').addEventListener('click', (e) => {
  const btn = e.target.closest('[data-finish]');
  if (!btn) return;
  storage.set('finish', btn.dataset.finish);
  view3d.viewer?.setFinish(btn.dataset.finish);
  updateHud();
});

document.addEventListener('fullscreenchange', () => {
  if (document.fullscreenElement || !view3d.open) return;
  // Esc в прогулке снимает и захват мыши, и полный экран — сцену при этом не закрываем.
  const keep = view3d.keepOnFsExit || view3d.mode === 'walk' || view3d.viewer?.justLeftWalk();
  view3d.keepOnFsExit = false;
  if (!keep) close3d();
});

document.addEventListener('keydown', (e) => {
  // Клавиши редактора обстановки: на плане или в 3D-облёте.
  const busy = e.target.closest?.('input, textarea') || document.querySelector('.modal:not([hidden])');
  const active = view3d.open ? view3d.mode === 'orbit' && view3d.editor : state.view === 'plan' && editor;
  if (!busy && active) {
    if (active.handleKey(e)) {
      e.preventDefault();
      return;
    }
    // Esc в 3D сначала выходит из режима обстановки и только потом закрывает сцену.
    if (e.key === 'Escape' && view3d.open && active.isEnabled()) return active.setEnabled(false);
  }
  if (e.key !== 'Escape') return;
  if (closeModals()) return;
  if (!view3d.open) return;
  if (view3d.mode === 'walk') view3d.viewer?.setMode('orbit');
  else if (!view3d.viewer?.justLeftWalk()) close3d();
});

/* ---------- Заявка ---------- */

function openLead() {
  const apt = state.current;
  if (!apt || isDev(apt) || apt.status === 'sold') return;
  const draft = storage.get('leadDraft', {});
  $('lead-name').value = draft.name || '';
  $('lead-phone').value = draft.phone || '+998';
  $('lead-apartment').textContent = `${aptTitle(apt)} · ${formatArea(planArea(apt.plan))} ${t('unit.m2')}`;
  $('lead-error').hidden = true;
  $('lead-form').hidden = false;
  $('lead-success').hidden = true;
  openModal($('modal-lead'));
}

function leadError(code) {
  $('lead-error').textContent = t(`lead.err.${code}`);
  $('lead-error').hidden = false;
}

$('lead-phone').addEventListener('input', (e) => {
  const digits = e.target.value.replace(/\D/g, '');
  e.target.value = `+${digits}`.slice(0, 13);
});

$('lead-form').addEventListener('input', () => {
  storage.set('leadDraft', { name: $('lead-name').value, phone: $('lead-phone').value });
  $('lead-error').hidden = true;
});

$('lead-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = $('lead-name').value.trim();
  const phone = $('lead-phone').value.trim();
  if (name.length < 2 || name.length > 60) return leadError('name');
  if (!PHONE_RE.test(phone)) return leadError('phone');

  const submit = $('lead-submit');
  submit.disabled = true;
  submit.textContent = t('lead.sending');
  try {
    const lead = await api.postLead({ apartmentId: state.current.id, name, phone });
    storage.remove('leadDraft');
    $('lead-success-text').textContent = t('lead.successText', { name: lead.name, phone: lead.phone });
    $('lead-form').hidden = true;
    $('lead-success').hidden = false;
  } catch (err) {
    leadError(['name', 'phone', 'apartment', 'sold'].includes(err.code) ? err.code : 'network');
  } finally {
    submit.disabled = false;
    submit.textContent = t('lead.submit');
  }
});

/* ---------- Dev-панель (?dev=1) ---------- */

function initDevPanel() {
  if (new URLSearchParams(location.search).get('dev') !== '1') return;
  $('dev-panel').hidden = false;
  window.__nd = { state, view3d }; // для отладки из консоли

  $('dev-random').addEventListener('click', async () => {
    const input = $('dev-seed');
    const seed = Math.abs(Math.trunc(Number(input.value))) || 1 + Math.floor(Math.random() * 999999);
    input.value = seed;
    const { randomApartment } = await import('./generator.js');
    const apt = randomApartment(seed);
    $('dev-error').hidden = Boolean(apt);
    if (!apt) return;
    const saved = storage.get('devApartments', []).filter((a) => a.id !== apt.id);
    storage.set('devApartments', [...saved, apt].slice(-20));
    close3d();
    openApartment(apt.id);
  });

  $('dev-reset').addEventListener('click', () => {
    storage.reset();
    location.reload();
  });
}

/* ---------- Шапка, язык, действия ---------- */

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
  fav: () => state.current && toggleFavorite(state.current.id),
  'open-3d': open3d,
  'close-3d': close3d,
  fullscreen: toggleFullscreen,
  'open-lead': openLead,
  'furnish-random': randomFurnish,
};

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action]');
  if (el && !el.disabled && actions[el.dataset.action]) actions[el.dataset.action](el);
});

/* ---------- Изображения ---------- */

// Мок-фотографии грузятся с внешнего адреса. Если он недоступен (нет интернета),
// картинка убирается и на её месте остаётся пустая заглушка.
function showPlaceholder(img) {
  if (!img.matches?.('img[data-photo]')) return;
  img.hidden = true;
  img.closest('.photo')?.classList.add('is-empty');
}
document.addEventListener('error', (e) => showPlaceholder(e.target), true);
document.querySelectorAll('img[data-photo]').forEach((img) => {
  if (img.complete && img.naturalWidth === 0) showPlaceholder(img); // ошибка случилась до загрузки скрипта
});

/* ---------- Запуск ---------- */

storage.init();
initLang();
applyI18n();
initLangSwitch();
initDevPanel();
onLangChange(() => {
  chess.render();
  renderApartment();
  updateHud();
  view3d.viewer?.refreshLabels();
  view3d.editor?.refresh();
});

state.filters = { ...DEFAULT_FILTERS, ...storage.get('filters', {}) };
state.favorites = storage.get('favorites', []);
chess.setState({ filters: state.filters, favorites: state.favorites });

loadApartments();

// Восстанавливаем последний экран. 3D требует жеста пользователя, поэтому открываем планировку.
const lastView = storage.get('lastView');
const selectedId = storage.get('selectedId');
if ((lastView === 'plan' || lastView === '3d') && typeof selectedId === 'string') openApartment(selectedId);
