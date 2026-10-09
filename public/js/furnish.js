// Редактор обстановки: каталог, установка, перетаскивание, поворот, удаление.
// Работает поверх «вида» — 2D-плана (plan2d.js) или 3D-сцены (scene3d.js). Вид умеет:
// toPlan(clientX, clientY), setFurniture, setGhost, setSelected, setFurnishMode,
// а в 3D ещё pick(clientX, clientY) → id предмета под курсором и lockCamera(on).
import { t } from './i18n.js';
import { CATALOG, GROUPS, canPlace, footprint, roomInterior } from './furniture.js';
import { roomAt } from './model.js';

const ICONS = {
  edit: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 18v-5a2 2 0 012-2h14a2 2 0 012 2v5M5 11V8a2 2 0 012-2h10a2 2 0 012 2v3M3 15h18M5 18v2M19 18v2" fill="none" stroke="currentColor" stroke-width="1.3"/></svg>',
  random: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="3" fill="none" stroke="currentColor" stroke-width="1.3"/><circle cx="9" cy="9" r="1.3" fill="currentColor"/><circle cx="15" cy="15" r="1.3" fill="currentColor"/><circle cx="15" cy="9" r="1.3" fill="currentColor"/><circle cx="9" cy="15" r="1.3" fill="currentColor"/></svg>',
  rotate: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 12a8 8 0 11-2.6-5.9M20 4v5h-5" fill="none" stroke="currentColor" stroke-width="1.3"/></svg>',
  remove: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13" fill="none" stroke="currentColor" stroke-width="1.3"/></svg>',
};
const SNAP = 12; // на таком расстоянии предмет прилипает к стене, см

export function createFurnishEditor({
  planView,
  canvas,
  tools,
  catalog,
  getPlan,
  getItems,
  onChange,
  onRandom,
  hintKey = 'furn.hint',
  capture = false, // в 3D слушаем события раньше OrbitControls
}) {
  let enabled = false;
  let group = GROUPS[0];
  let pending = null; // { type, rot } — предмет из каталога, который сейчас ставим
  let selected = null; // id выбранного предмета
  let drag = null; // { item, dx, dy, candidate, ok }
  let lastPoint = null;
  let error = null;

  const items = () => getItems();
  const byId = (id) => items().find((i) => i.id === id);

  function nextId() {
    const max = items().reduce((m, i) => Math.max(m, Number(String(i.id).slice(1)) || 0), 0);
    return `f${max + 1}`;
  }

  // Округляет позицию и прижимает предмет к стенам комнаты, если он рядом с ними.
  function snap(item) {
    const plan = getPlan();
    const next = { ...item, x: Math.round(item.x), y: Math.round(item.y) };
    const room = roomAt(plan, next.x, next.y);
    if (!room) return next;
    const inner = roomInterior(plan, room);
    const fp = footprint(next);
    if (fp.x0 - inner.x0 < SNAP) next.x += inner.x0 - fp.x0;
    else if (inner.x1 - fp.x1 < SNAP) next.x += inner.x1 - fp.x1;
    if (fp.y0 - inner.y0 < SNAP) next.y += inner.y0 - fp.y0;
    else if (inner.y1 - fp.y1 < SNAP) next.y += inner.y1 - fp.y1;
    return next;
  }

  function hitTest(point, e) {
    // В 3D предмет выбирается лучом — по тому, что видно под курсором.
    if (planView.pick) return byId(planView.pick(e.clientX, e.clientY)) || null;
    const inside = (i) => {
      const fp = footprint(i);
      return point.x >= fp.x0 && point.x <= fp.x1 && point.y >= fp.y0 && point.y <= fp.y1;
    };
    const list = [...items()].reverse().filter(inside);
    // Ковёр выбираем, только если на нём ничего не стоит под курсором.
    return list.find((i) => !CATALOG[i.type].flat) || list[0] || null;
  }

  function render() {
    const plan = getPlan();
    tools.hidden = !plan;
    if (!plan) {
      catalog.hidden = true;
      return;
    }
    const chip = (action, label, icon = '', active = false) =>
      `<button class="chip${active ? ' is-active' : ''}" data-furnish="${action}">${icon}${label}</button>`;
    tools.innerHTML = [
      chip('toggle', t(enabled ? 'furn.done' : 'furn.edit'), ICONS.edit, enabled),
      chip('random', t('furn.random'), ICONS.random),
      items().length ? chip('clear', t('furn.clear')) : '',
      selected && byId(selected) ? chip('rotate', t('furn.rotate'), ICONS.rotate) + chip('remove', t('furn.delete'), ICONS.remove) : '',
      items().length ? `<span class="plan-tools-count">${t('furn.count', { n: items().length })}</span>` : '',
    ].join('');

    catalog.hidden = !enabled;
    if (!enabled) return;
    const list = Object.values(CATALOG).filter((def) => def.group === group);
    catalog.innerHTML = `
      <div class="catalog-tabs">${GROUPS.map(
        (g) => `<button class="catalog-tab${g === group ? ' is-active' : ''}" data-group="${g}">${t(`room.${g}`)}</button>`,
      ).join('')}</div>
      <div class="catalog-items">${list
        .map(
          (def) =>
            `<button class="catalog-item${pending?.type === def.type ? ' is-active' : ''}" data-type="${def.type}"><span>${t(`furn.${def.type}`)}</span><small>${def.w} × ${def.d}</small></button>`,
        )
        .join('')}</div>
      <p class="catalog-hint${error ? ' is-error' : ''}">${t(error ? `furn.err.${error}` : pending ? 'furn.hintPlace' : hintKey)}</p>`;
  }

  function sync() {
    planView.setFurnishMode(enabled);
    planView.setFurniture(drag ? items().filter((i) => i.id !== drag.item.id) : items());
    planView.setSelected(enabled && !drag ? selected : null);
    canvas.style.cursor = !enabled ? '' : pending ? 'copy' : drag ? 'grabbing' : 'default';
    if (!planView.pick) canvas.style.touchAction = enabled ? 'none' : '';
  }

  function setError(reason) {
    if (reason === error) return;
    error = reason;
    render();
  }

  function showGhost(candidate) {
    const check = canPlace(getPlan(), items(), candidate);
    planView.setGhost({ item: candidate, ok: check.ok });
    setError(check.ok ? null : check.reason);
    return check.ok;
  }

  function pendingAt(point) {
    return snap({ id: 'ghost', type: pending.type, rot: pending.rot, x: point.x, y: point.y });
  }

  function commit(next) {
    onChange(next);
    render();
    sync();
  }

  function onPointerMove(e) {
    if (!enabled) return;
    lastPoint = planView.toPlan(e.clientX, e.clientY);
    if (pending) {
      showGhost(pendingAt(lastPoint));
    } else if (drag) {
      drag.candidate = snap({ ...drag.item, x: lastPoint.x - drag.dx, y: lastPoint.y - drag.dy });
      drag.ok = showGhost(drag.candidate);
    }
  }

  function onPointerDown(e) {
    if (!enabled || e.button > 0) return;
    const point = planView.toPlan(e.clientX, e.clientY);
    lastPoint = point;
    if (pending) {
      planView.lockCamera?.(true);
      const candidate = pendingAt(point);
      if (!showGhost(candidate)) return;
      const item = { ...candidate, id: nextId() };
      pending = null;
      selected = item.id;
      planView.setGhost(null);
      commit([...items(), item]);
      return;
    }
    const hit = hitTest(point, e);
    selected = hit?.id ?? null;
    if (hit) {
      planView.lockCamera?.(true);
      drag = { item: hit, dx: point.x - hit.x, dy: point.y - hit.y, candidate: hit, ok: true };
      try {
        canvas.setPointerCapture(e.pointerId);
      } catch {
        /* указатель уже отпущен — перетаскивание работает и без захвата */
      }
      planView.setGhost({ item: hit, ok: true });
    }
    setError(null);
    render();
    sync();
  }

  function onPointerUp() {
    planView.lockCamera?.(false);
    if (!drag) return;
    const { item, candidate, ok } = drag;
    drag = null;
    planView.setGhost(null);
    setError(null);
    if (ok && (candidate.x !== item.x || candidate.y !== item.y)) {
      commit(items().map((i) => (i.id === item.id ? candidate : i)));
    } else {
      render();
      sync();
    }
  }

  function onPointerLeave() {
    if (pending) planView.setGhost(null);
  }

  function rotate() {
    if (pending) {
      pending.rot = (pending.rot + 90) % 360;
      if (lastPoint) showGhost(pendingAt(lastPoint));
      return;
    }
    const item = byId(selected);
    if (!item) return;
    const turned = snap({ ...item, rot: (item.rot + 90) % 360 });
    const check = canPlace(getPlan(), items(), turned);
    if (!check.ok) return setError(check.reason);
    setError(null);
    commit(items().map((i) => (i.id === item.id ? turned : i)));
  }

  function remove() {
    if (!byId(selected)) return;
    const id = selected;
    selected = null;
    commit(items().filter((i) => i.id !== id));
  }

  function cancel() {
    pending = null;
    planView.setGhost(null);
    error = null;
    render();
    sync();
  }

  function setEnabled(value) {
    enabled = value;
    pending = null;
    selected = null;
    drag = null;
    error = null;
    planView.setGhost(null);
    render();
    sync();
  }

  function onToolsClick(e) {
    const action = e.target.closest('[data-furnish]')?.dataset.furnish;
    if (action === 'toggle') setEnabled(!enabled);
    else if (action === 'random') {
      selected = null;
      pending = null;
      onRandom();
    } else if (action === 'clear') {
      selected = null;
      commit([]);
    } else if (action === 'rotate') rotate();
    else if (action === 'remove') remove();
  }

  function onCatalogClick(e) {
    const tab = e.target.closest('[data-group]');
    const entry = e.target.closest('[data-type]');
    if (tab) {
      group = tab.dataset.group;
      render();
    } else if (entry) {
      pending = pending?.type === entry.dataset.type ? null : { type: entry.dataset.type, rot: 0 };
      selected = null;
      error = null;
      planView.setGhost(null);
      render();
      sync();
    }
  }

  const pointerEvents = [
    ['pointermove', onPointerMove],
    ['pointerdown', onPointerDown],
    ['pointerup', onPointerUp],
    ['pointercancel', onPointerUp],
    ['pointerleave', onPointerLeave],
  ];
  pointerEvents.forEach(([type, fn]) => canvas.addEventListener(type, fn, capture));
  tools.addEventListener('click', onToolsClick);
  catalog.addEventListener('click', onCatalogClick);

  return {
    isEnabled: () => enabled,
    setEnabled,
    destroy() {
      pointerEvents.forEach(([type, fn]) => canvas.removeEventListener(type, fn, capture));
      tools.removeEventListener('click', onToolsClick);
      catalog.removeEventListener('click', onCatalogClick);
      tools.innerHTML = '';
      catalog.innerHTML = '';
      catalog.hidden = true;
    },
    // Перерисовать панели после смены языка, квартиры или списка предметов.
    refresh() {
      if (selected && !byId(selected)) selected = null;
      render();
      sync();
    },
    // Клавиши редактора. → true, если клавиша обработана.
    handleKey(e) {
      if (!enabled) return false;
      if (e.code === 'KeyR') rotate();
      else if (e.key === 'Delete' || e.key === 'Backspace') remove();
      else if (e.key === 'Escape' && pending) cancel();
      else if (e.key === 'Escape' && selected) {
        selected = null;
        render();
        sync();
      } else return false;
      return true;
    },
  };
}
