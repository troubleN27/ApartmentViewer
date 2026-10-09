// Шахматка: этажи × квартиры, фильтры, легенда, избранное.
import { t } from './i18n.js';
import { formatArea, formatPrice } from './model.js';

export const STAR_ICON =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.9L12 16.9 6.8 19.7l1-5.9L3.5 9.7l5.9-.8z" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/></svg>';

export const DEFAULT_FILTERS = { rooms: 0, price: 'any', fav: false };
const STATUSES = ['free', 'reserved', 'sold'];
const PRICE_RANGES = {
  any: [0, Infinity],
  low: [0, 500e6],
  mid: [500e6, 700e6],
  high: [700e6, Infinity],
};

export function matchesFilters(apt, filters, favorites) {
  const [min, max] = PRICE_RANGES[filters.price] || PRICE_RANGES.any;
  return (
    (!filters.rooms || apt.rooms === filters.rooms) &&
    apt.price >= min &&
    apt.price < max &&
    (!filters.fav || favorites.includes(apt.id))
  );
}

export function createChess({ grid, filtersEl, legendEl, statusEl, tooltip, onSelect, onToggleFav, onFilters }) {
  let apartments = [];
  let filters = { ...DEFAULT_FILTERS };
  let favorites = [];
  let message = 'chess.loading';

  const byId = (id) => apartments.find((a) => a.id === id);

  function renderFilters() {
    const chip = (key, value, label, extra = '') =>
      `<button class="chip${filters[key] === value ? ' is-active' : ''}" data-key="${key}" data-value="${value}" aria-pressed="${filters[key] === value}">${extra}${label}</button>`;
    const roomCounts = [...new Set(apartments.map((a) => a.rooms))].sort();
    filtersEl.innerHTML = `
      <div class="filter-group">
        <span class="filter-label">${t('filter.rooms')}</span>
        ${chip('rooms', 0, t('filter.all'))}
        ${roomCounts.map((n) => chip('rooms', n, n)).join('')}
      </div>
      <div class="filter-group">
        <span class="filter-label">${t('filter.price')}</span>
        ${['any', 'low', 'mid', 'high'].map((k) => chip('price', k, t(`filter.${k}`))).join('')}
      </div>
      <div class="filter-group">
        ${chip('fav', true, t('filter.fav'), STAR_ICON).replace('data-value="true"', 'data-toggle')}
      </div>`;
  }

  function renderLegend() {
    legendEl.innerHTML = STATUSES.map(
      (s) => `<span class="legend-item"><i class="legend-dot status-${s}"></i>${t(`status.${s}`)}</span>`,
    ).join('');
  }

  function renderGrid() {
    const floors = [...new Set(apartments.map((a) => a.floor))].sort((p, q) => q - p);
    let found = 0;
    grid.innerHTML = floors
      .map((floor, i) => {
        const cells = apartments
          .filter((a) => a.floor === floor)
          .sort((p, q) => p.number - q.number)
          .map((a) => {
            const match = matchesFilters(a, filters, favorites);
            if (match) found++;
            const fav = favorites.includes(a.id);
            const label = `${t('plan.apartment', { n: a.number })}, ${t('plan.floor', { n: a.floor })}, ${t(`status.${a.status}`)}`;
            return `
              <div class="cell status-${a.status}${match ? '' : ' is-dim'}${fav ? ' is-fav' : ''}" role="button" tabindex="0" data-id="${a.id}" aria-label="${label}">
                <span class="cell-rooms">${t('rooms.short', { n: a.rooms })}</span>
                <span class="cell-area">${formatArea(a.area)} <small>${t('unit.m2')}</small></span>
                <span class="cell-price">${formatPrice(a.price)} <small>${t('unit.sum')}</small></span>
                <button class="cell-fav" aria-pressed="${fav}" aria-label="${t(fav ? 'fav.remove' : 'fav.add')}">${STAR_ICON}</button>
              </div>`;
          })
          .join('');
        return `
          <div class="floor-row" style="animation-delay:${i * 35}ms">
            <div class="floor-label">${floor}<small>${t('chess.floor')}</small></div>
            <div class="floor-cells">${cells}</div>
          </div>`;
      })
      .join('');

    const filtered = filters.rooms || filters.price !== 'any' || filters.fav;
    if (message) statusEl.textContent = t(message);
    else if (!filtered) statusEl.textContent = '';
    else statusEl.textContent = found ? t('chess.found', { n: found }) : t('chess.noMatch');
  }

  function render() {
    renderFilters();
    renderLegend();
    renderGrid();
  }

  function showTooltip(cell, e) {
    const a = byId(cell.dataset.id);
    if (!a) return;
    tooltip.innerHTML = `
      <strong>${t('plan.apartment', { n: a.number })} · ${t('plan.floor', { n: a.floor })}</strong>
      <div>${t('rooms.full', { n: a.rooms })}, ${formatArea(a.area)} ${t('unit.m2')}</div>
      <div class="tt-gold">${formatPrice(a.price)} ${t('unit.sum')}</div>
      <div class="tt-muted">${t(`status.${a.status}`)}</div>`;
    tooltip.hidden = false;
    const box = tooltip.getBoundingClientRect();
    const x = Math.min(e.clientX + 16, window.innerWidth - box.width - 8);
    const y = e.clientY + 18 + box.height > window.innerHeight ? e.clientY - box.height - 12 : e.clientY + 18;
    tooltip.style.left = `${Math.max(8, x)}px`;
    tooltip.style.top = `${Math.max(8, y)}px`;
  }

  filtersEl.addEventListener('click', (e) => {
    const chip = e.target.closest('.chip');
    if (!chip) return;
    const { key, value } = chip.dataset;
    if ('toggle' in chip.dataset) filters = { ...filters, [key]: !filters[key] };
    else filters = { ...filters, [key]: key === 'rooms' ? Number(value) : value };
    onFilters(filters);
    render();
  });

  grid.addEventListener('click', (e) => {
    const cell = e.target.closest('.cell');
    if (!cell) return;
    if (e.target.closest('.cell-fav')) onToggleFav(cell.dataset.id);
    else onSelect(cell.dataset.id);
  });
  grid.addEventListener('keydown', (e) => {
    if ((e.key === 'Enter' || e.key === ' ') && e.target.classList.contains('cell')) {
      e.preventDefault();
      onSelect(e.target.dataset.id);
    }
  });
  grid.addEventListener('pointermove', (e) => {
    const cell = e.pointerType === 'mouse' && e.target.closest('.cell');
    if (cell) showTooltip(cell, e);
    else tooltip.hidden = true;
  });
  grid.addEventListener('pointerleave', () => (tooltip.hidden = true));

  return {
    setData(list) {
      apartments = list;
      message = null;
      render();
    },
    setMessage(key) {
      message = key;
      render();
    },
    setState(next) {
      if (next.filters) filters = { ...DEFAULT_FILTERS, ...next.filters };
      if (next.favorites) favorites = next.favorites;
      render();
    },
    render,
  };
}
