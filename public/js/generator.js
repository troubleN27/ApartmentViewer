// Случайная валидная квартира по seed: рекурсивное деление прямоугольника
// на комнаты по целевым площадям, затем расстановка дверей и окон.
import { buildWalls, validatePlan, countLivingRooms } from './model.js';

export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const MARGIN = 20; // отступ проёма от конца стены
const STEP = 10;
const CANDIDATES = 12; // сколько разбиений сравниваем на один seed

// Целевая площадь комнаты, м².
const AREA = {
  living: [17, 23],
  bedroom: [12, 16],
  kitchen: [9, 13],
  hall: [5, 8],
  bathroom: [3.6, 5.2],
};
// Минимальная сторона (см) и максимальная вытянутость комнаты.
const MIN_SIDE = { living: 280, bedroom: 260, kitchen: 220, hall: 150, bathroom: 150 };
const MAX_RATIO = { living: 2, bedroom: 2, kitchen: 2.2, hall: 3, bathroom: 2 };

const int = (rng, lo, hi) => lo + Math.floor(rng() * (hi - lo + 1));
const snap = (v) => Math.round(v / STEP) * STEP;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const along = (o) => (o.dir === 'h' ? o.x : o.y);
const weight = (items) => items.reduce((s, it) => s + it.area, 0);

function shuffle(rng, list) {
  for (let i = list.length - 1; i > 0; i--) {
    const j = int(rng, 0, i);
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

// Делит прямоугольник между комнатами пропорционально их площадям:
// список режется примерно пополам по весу, прямоугольник — поперёк длинной стороны.
function split(rng, rect, items, out) {
  if (items.length === 1) {
    const [item] = items;
    // Входной блок: прихожая и санузел рядом.
    if (item.parts) split(rng, rect, shuffle(rng, [...item.parts]), out);
    else out.push({ type: item.type, ...rect });
    return;
  }
  const total = weight(items);
  let k = 1;
  let acc = 0;
  let best = Infinity;
  for (let i = 0; i < items.length - 1; i++) {
    acc += items[i].area;
    if (Math.abs(acc - total / 2) < best) {
      best = Math.abs(acc - total / 2);
      k = i + 1;
    }
  }
  const share = weight(items.slice(0, k)) / total;
  const byX = rect.w > rect.l || (rect.w === rect.l && rng() < 0.5);
  const size = byX ? rect.w : rect.l;
  const cut = clamp(snap(size * share), STEP, size - STEP);
  const [a, b] = byX
    ? [{ ...rect, w: cut }, { ...rect, x: rect.x + cut, w: rect.w - cut }]
    : [{ ...rect, l: cut }, { ...rect, y: rect.y + cut, l: rect.l - cut }];
  split(rng, a, items.slice(0, k), out);
  split(rng, b, items.slice(k), out);
}

// Комнаты квартиры: { width, length, rooms } либо null, если пропорции не подошли.
function layout(rng, living) {
  const item = (type) => {
    const [lo, hi] = AREA[type];
    return { type, area: (lo + rng() * (hi - lo)) * 10000 };
  };
  const entry = [item('hall'), item('bathroom')];
  const items = [
    item('living'),
    ...Array.from({ length: living - 1 }, () => item('bedroom')),
    item('kitchen'),
    { area: weight(entry), parts: entry },
  ];
  const total = weight(items);
  const width = snap(Math.sqrt(total * (1.15 + rng() * 0.4)));
  const length = snap(total / width);

  const rects = [];
  split(rng, { x: 0, y: 0, w: width, l: length }, shuffle(rng, items), rects);
  const ok = rects.every((r) => {
    const lo = Math.min(r.w, r.l);
    return lo >= MIN_SIDE[r.type] && Math.max(r.w, r.l) / lo <= MAX_RATIO[r.type];
  });
  if (!ok) return null;
  // Санузел — самая маленькая комната.
  const bath = rects.find((r) => r.type === 'bathroom');
  if (rects.some((r) => r !== bath && r.w * r.l <= bath.w * bath.l)) return null;
  return { width, length, rooms: rects.map((r, i) => ({ id: `r${i + 1}`, ...r })) };
}

function opening(type, wall, start, width) {
  return wall.dir === 'h'
    ? { type, x: start, y: wall.y, width, dir: 'h' }
    : { type, x: wall.x, y: start, width, dir: 'v' };
}

function place(rng, wall, width, type) {
  return opening(type, wall, along(wall) + int(rng, MARGIN, wall.len - width - MARGIN), width);
}

// Двери и окна для готовых комнат. → { openings, score } либо null.
// score — сколько комнат открывается прямо из прихожей.
function furnish(rng, { rooms }) {
  const walls = buildWalls({ rooms });
  const outerOf = (id, min) =>
    walls.filter((w) => w.kind === 'outer' && (w.a ?? w.b) === id && w.len >= min).sort((p, q) => q.len - p.len);
  const hall = rooms.find((r) => r.type === 'hall');
  const bath = rooms.find((r) => r.type === 'bathroom');
  const lit = rooms.filter((r) => r !== hall && r !== bath);

  // Прихожей нужна внешняя стена под вход, жилым комнатам и кухне — под окно.
  const entranceWall = outerOf(hall.id, 90 + 2 * MARGIN)[0];
  if (!entranceWall || lit.some((r) => !outerOf(r.id, 60 + 2 * MARGIN).length)) return null;

  // Смежность: общая стена, на которой помещается дверь.
  const links = new Map(rooms.map((r) => [r.id, []]));
  for (const w of walls) {
    if (w.kind !== 'inner') continue;
    const min = (w.a === bath.id || w.b === bath.id ? 70 : 80) + 2 * MARGIN;
    if (w.len < min) continue;
    links.get(w.a).push({ to: w.b, wall: w });
    links.get(w.b).push({ to: w.a, wall: w });
  }

  // Двери: обход в ширину от прихожей; санузел — тупиковая комната.
  const doors = [];
  const seen = new Set([hall.id]);
  const queue = [hall.id];
  let bathLink = null;
  let score = 0;
  while (queue.length) {
    const from = queue.shift();
    for (const link of links.get(from)) {
      if (link.to === bath.id) {
        if (!bathLink && from === hall.id) score++;
        bathLink ||= link;
      } else if (!seen.has(link.to)) {
        seen.add(link.to);
        queue.push(link.to);
        doors.push(link);
        if (from === hall.id) score++;
      }
    }
  }
  if (!bathLink || seen.size !== rooms.length - 1) return null;
  doors.push(bathLink);

  const openings = [place(rng, entranceWall, 90, 'entrance')];
  for (const { to, wall } of doors) {
    const wide = wall.len >= 90 + 2 * MARGIN && rng() < 0.4 ? 90 : 80;
    openings.push(place(rng, wall, to === bath.id ? 70 : wide, 'door'));
  }
  for (const r of lit) {
    for (const wall of outerOf(r.id, 60 + 2 * MARGIN).slice(0, r.type === 'living' ? 2 : 1)) {
      const w = clamp(snap(wall.len * 0.45), 60, Math.min(200, wall.len - 2 * MARGIN));
      openings.push(opening('window', wall, along(wall) + Math.round((wall.len - w) / 2), w));
    }
  }
  return { openings, score };
}

// План по seed либо null, если ни одно разбиение не подошло.
// Из нескольких разбиений берётся то, где из прихожей открывается больше комнат.
export function generatePlan(seed, roomsCount) {
  const rng = mulberry32(seed);
  const living = roomsCount || int(rng, 1, 3);
  const height = [270, 280, 300][int(rng, 0, 2)];

  let best = null;
  for (let i = 0; i < CANDIDATES; i++) {
    const base = layout(rng, living);
    const result = base && furnish(rng, base);
    if (result && (!best || result.score > best.score)) best = { ...base, ...result };
  }
  if (!best) return null;

  return {
    width: best.width,
    length: best.length,
    height,
    rooms: best.rooms.map((r) => ({ id: r.id, type: r.type, x: r.x, y: r.y, w: r.w, l: r.l })),
    openings: best.openings,
  };
}

// Квартира с валидным планом. Если seed не подошёл — пробуется следующий.
export function randomApartment(seed, { rooms } = {}) {
  seed = Math.abs(Math.trunc(Number(seed))) || 1;
  for (let i = 0; i < 500; i++) {
    const plan = generatePlan(seed + i, rooms);
    if (!plan || !validatePlan(plan).ok) continue;
    const rng = mulberry32(seed ^ 0x9e3779b9);
    return {
      id: `DEV-${seed}`,
      seed,
      floor: int(rng, 1, 9),
      number: int(rng, 1, 6),
      rooms: countLivingRooms(plan),
      pricePerM2: int(rng, 80, 140) * 100000,
      status: 'free',
      plan,
    };
  }
  return null;
}
