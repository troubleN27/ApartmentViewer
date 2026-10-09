// Случайная валидная квартира по seed: рекурсивное деление прямоугольника
// на комнаты, затем расстановка дверей и окон.
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

const MIN_SIDE = 180; // минимальная сторона комнаты
const MARGIN = 20; // отступ проёма от конца стены
const STEP = 10;

// Габариты квартиры по комнатности: [ширина от, до, длина от, до].
const SIZES = {
  1: [660, 780, 560, 640],
  2: [820, 960, 650, 750],
  3: [980, 1150, 740, 850],
};

const int = (rng, lo, hi) => lo + Math.floor(rng() * (hi - lo + 1));
const snap = (v) => Math.round(v / STEP) * STEP;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const along = (o) => (o.dir === 'h' ? o.x : o.y);

// Делит самый большой прямоугольник поперёк длинной стороны, пока не наберётся count.
function subdivide(rng, width, length, count) {
  const rects = [{ x: 0, y: 0, w: width, l: length }];
  while (rects.length < count) {
    rects.sort((p, q) => q.w * q.l - p.w * p.l);
    const r = rects.shift();
    const byX = r.w > r.l || (r.w === r.l && rng() < 0.5);
    const size = byX ? r.w : r.l;
    if (size < 2 * MIN_SIDE) return null;
    const cut = clamp(snap(size * (0.38 + rng() * 0.24)), MIN_SIDE, size - MIN_SIDE);
    if (byX) {
      rects.push({ x: r.x, y: r.y, w: cut, l: r.l }, { x: r.x + cut, y: r.y, w: r.w - cut, l: r.l });
    } else {
      rects.push({ x: r.x, y: r.y, w: r.w, l: cut }, { x: r.x, y: r.y + cut, w: r.w, l: r.l - cut });
    }
  }
  return rects;
}

function opening(type, wall, start, width) {
  return wall.dir === 'h'
    ? { type, x: start, y: wall.y, width, dir: 'h' }
    : { type, x: wall.x, y: start, width, dir: 'v' };
}

function place(rng, wall, width, type) {
  return opening(type, wall, along(wall) + int(rng, MARGIN, wall.len - width - MARGIN), width);
}

// План по seed либо null, если разбиение не подошло.
export function generatePlan(seed, roomsCount) {
  const rng = mulberry32(seed);
  const living = roomsCount || int(rng, 1, 3);
  const [w0, w1, l0, l1] = SIZES[living];
  const width = snap(int(rng, w0, w1));
  const length = snap(int(rng, l0, l1));
  const height = [270, 280, 300][int(rng, 0, 2)];

  const rects = subdivide(rng, width, length, living + 3);
  if (!rects) return null;
  const rooms = rects.map((r, i) => ({ id: `r${i + 1}`, type: 'hall', ...r }));
  const area = (r) => r.w * r.l;

  const walls = buildWalls({ rooms });
  const outerOf = (id, min) =>
    walls.filter((w) => w.kind === 'outer' && (w.a ?? w.b) === id && w.len >= min).sort((p, q) => q.len - p.len);
  // Каждой комнате нужна внешняя стена — под окно или вход.
  if (rooms.some((r) => !outerOf(r.id, 90 + 2 * MARGIN).length)) return null;

  // Смежность: общая стена, на которой помещается дверь.
  const links = new Map(rooms.map((r) => [r.id, []]));
  for (const w of walls) {
    if (w.kind === 'inner' && w.len >= 80 + 2 * MARGIN) {
      links.get(w.a).push({ to: w.b, wall: w });
      links.get(w.b).push({ to: w.a, wall: w });
    }
  }

  // Прихожая — комната с наибольшим числом соседей (из равных — меньшая).
  const hall = [...rooms].sort((p, q) => links.get(q.id).length - links.get(p.id).length || area(p) - area(q))[0];
  const rest = rooms.filter((r) => r !== hall).sort((p, q) => area(p) - area(q));
  const bath = rest[0];
  bath.type = 'bathroom';
  rest[1].type = 'kitchen';
  rest.slice(2).forEach((r) => (r.type = 'bedroom'));
  rest[rest.length - 1].type = 'living';

  // Двери: обход в ширину от прихожей; санузел — тупиковая комната.
  const doors = [];
  const seen = new Set([hall.id]);
  const queue = [hall.id];
  let bathLink = null;
  while (queue.length) {
    for (const link of links.get(queue.shift())) {
      if (link.to === bath.id) {
        bathLink ||= link;
      } else if (!seen.has(link.to)) {
        seen.add(link.to);
        queue.push(link.to);
        doors.push(link);
      }
    }
  }
  if (!bathLink || seen.size !== rooms.length - 1) return null;
  doors.push(bathLink);

  const openings = [place(rng, outerOf(hall.id, 90 + 2 * MARGIN)[0], 90, 'entrance')];
  for (const { to, wall } of doors) {
    const max = Math.min(90, wall.len - 2 * MARGIN);
    const wide = max >= 90 && rng() < 0.4 ? 90 : 80;
    openings.push(place(rng, wall, to === bath.id ? 70 : wide, 'door'));
  }
  for (const r of rooms) {
    if (r === hall || r === bath) continue;
    const outer = outerOf(r.id, 60 + 2 * MARGIN);
    for (const wall of outer.slice(0, r.type === 'living' ? 2 : 1)) {
      const w = clamp(snap(wall.len * 0.45), 60, Math.min(200, wall.len - 2 * MARGIN));
      openings.push(opening('window', wall, along(wall) + Math.round((wall.len - w) / 2), w));
    }
  }

  return {
    width,
    length,
    height,
    rooms: rooms.map((r) => ({ id: r.id, type: r.type, x: r.x, y: r.y, w: r.w, l: r.l })),
    openings,
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
