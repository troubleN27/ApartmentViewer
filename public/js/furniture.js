// Мебель, техника и сантехника: каталог, правила расстановки, случайная обстановка.
// Чистые функции без DOM. Размеры в сантиметрах.
//
// Предмет: { id, type, x, y, rot } — x, y — центр на плане, rot — 0 | 90 | 180 | 270.
// При rot = 0 спинка предмета смотрит вверх плана (−Y), лицевая сторона — вниз (+Y).
import { roomAt, wallOfOpening, buildWalls, OUTER_T, INNER_T, PLAYER_R } from './model.js';
import { mulberry32 } from './generator.js';

/* ---------- Материалы ---------- */

// color — базовый цвет (он же заливка на 2D-плане), tex — процедурная текстура в 3D.
export const MATERIALS = {
  oak: { color: '#D2B48A', tex: 'grain', rough: 0.55 },
  walnut: { color: '#8A6444', tex: 'grain', rough: 0.5 },
  white: { color: '#F6F3EE', rough: 0.45 },
  cabinet: { color: '#EDE8DF', rough: 0.4 },
  fabric: { color: '#BFB8AB', tex: 'weave', rough: 0.95 },
  fabricLight: { color: '#D8D2C6', tex: 'weave', rough: 0.95 },
  fabricDark: { color: '#7E8A84', tex: 'weave', rough: 0.95 },
  accent: { color: '#B8955A', tex: 'weave', rough: 0.95 },
  mattress: { color: '#F4F1EC', tex: 'weave', rough: 0.9 },
  pillow: { color: '#FFFFFF', tex: 'weave', rough: 0.9 },
  blanket: { color: '#A9B8A6', tex: 'weave', rough: 0.95 },
  rug: { color: '#FFFFFF', tex: 'rug', rough: 1, flatColor: '#DCCFBB' },
  stone: { color: '#E6E1D9', tex: 'stone', rough: 0.35 },
  steel: { color: '#C9CDD0', tex: 'brushed', rough: 0.35, metal: 0.35 },
  chrome: { color: '#D4D8DB', rough: 0.2, metal: 0.4 },
  black: { color: '#2E2F33', rough: 0.5 },
  screen: { color: '#14161B', rough: 0.12 },
  ceramic: { color: '#FFFFFF', rough: 0.12 },
  basin: { color: '#E3EBED', rough: 0.1 },
  glass: { color: '#BCD6DE', rough: 0.05, opacity: 0.28 },
  mirror: { color: '#CFDDE2', rough: 0.05, metal: 0.3 },
  green: { color: '#7FA06F', rough: 0.9 },
  pot: { color: '#B5825F', rough: 0.8 },
  lampshade: { color: '#F5E7C6', rough: 0.9, emissive: '#6B5A30' },
  burner: { color: '#55575C', rough: 0.4 },
  seam: { color: '#4A4743', rough: 0.8 },
  bookA: { color: '#8C4B3C', rough: 0.8 },
  bookB: { color: '#3F5B6B', rough: 0.8 },
  bookC: { color: '#C9B78D', rough: 0.8 },
};

/* ---------- Каталог ---------- */

// Детали предмета в его собственных координатах: x — вдоль ширины (0…w),
// y — в глубину от спинки (0…d), z — высота от пола.
const b = (x, y, z, sx, sy, sz, mat) => ({ shape: 'box', x, y, z, sx, sy, sz, mat });
const c = (x, y, z, r, h, mat, rTop = r) => ({ shape: 'cyl', x, y, z, r, h, mat, rTop });
const s = (x, y, z, r, mat) => ({ shape: 'sphere', x, y, z, r, mat });

const legs = (w, d, h, mat, inset = 3, size = 4) => [
  b(inset, inset, 0, size, size, h, mat),
  b(w - inset - size, inset, 0, size, size, h, mat),
  b(inset, d - inset - size, 0, size, size, h, mat),
  b(w - inset - size, d - inset - size, 0, size, size, h, mat),
];

function sofaParts(w, d, seats) {
  const arm = 18;
  const seat = (w - 2 * arm - 2) / seats;
  return [
    ...legs(w, d, 10, 'black', 6),
    b(0, 0, 10, w, d, 30, 'fabric'),
    b(0, 0, 40, w, 24, 42, 'fabric'),
    b(0, 24, 40, arm, d - 24, 22, 'fabric'),
    b(w - arm, 24, 40, arm, d - 24, 22, 'fabric'),
    ...Array.from({ length: seats }, (_, i) => b(arm + 1 + i * seat, 25, 40, seat - 1, d - 27, 12, 'fabricLight')),
    ...Array.from({ length: seats }, (_, i) => b(arm + 4 + i * seat, 25, 52, seat - 7, 13, 26, 'fabricLight')),
    b(arm + 3, 38, 52, 38, 12, 30, 'accent'),
  ];
}

function bedParts(w) {
  const pillows = w > 130 ? [b(10, 16, 52, w / 2 - 16, 42, 11, 'pillow'), b(w / 2 + 6, 16, 52, w / 2 - 16, 42, 11, 'pillow')] : [b(12, 16, 52, w - 24, 42, 11, 'pillow')];
  return [
    b(0, 0, 0, w, 8, 105, 'fabricDark'),
    b(0, 8, 8, w, 202, 22, 'oak'),
    ...legs(w, 210, 8, 'black', 6),
    b(4, 10, 30, w - 8, 196, 22, 'mattress'),
    ...pillows,
    b(2, 72, 52, w - 4, 136, 4, 'blanket'),
    b(2, 72, 30, 2.5, 136, 22, 'blanket'),
    b(w - 4.5, 72, 30, 2.5, 136, 22, 'blanket'),
  ];
}

function cabinetParts(w, d, h, mat, doors, handle = 'chrome') {
  const dw = w / doors;
  return [
    b(0, 0, 0, w, d - 2, h, mat),
    ...Array.from({ length: doors }, (_, i) => b(i * dw + 0.6, d - 2, 4, dw - 1.2, 2, h - 6, mat)),
    ...Array.from({ length: doors }, (_, i) => b(i * dw + (i % 2 ? 4 : dw - 6), d, h * 0.42, 2, 2.5, Math.min(40, h * 0.2), handle)),
    b(1, 2, 0, w - 2, d - 6, 4, 'seam'),
  ];
}

// Кухонный модуль: цоколь, корпус, фасад с ручкой, столешница.
function kitchenBase(w) {
  return [
    b(0, 5, 0, w, 50, 10, 'black'),
    b(0, 0, 10, w, 56, 76, 'cabinet'),
    b(1, 56, 11, w - 2, 2, 74, 'cabinet'),
    b(w / 2 - 12, 58, 77, 24, 2, 1.5, 'chrome'),
    b(0, 0, 86, w, 61, 4, 'stone'),
  ];
}

const DEFS = {
  // Гостиная
  sofa: { group: 'living', w: 220, d: 95, h: 82, front: 40, parts: sofaParts(220, 95, 3) },
  armchair: { group: 'living', w: 90, d: 90, h: 82, front: 30, parts: sofaParts(90, 90, 1).filter((p) => p.mat !== 'accent') },
  coffeeTable: {
    group: 'living', w: 110, d: 60, h: 50,
    parts: [...legs(110, 60, 36, 'black', 5, 3), b(8, 8, 14, 94, 44, 2, 'walnut'), b(0, 0, 36, 110, 60, 4, 'walnut'), b(20, 18, 40, 26, 18, 3, 'bookC'), c(80, 30, 40, 7, 9, 'pot')],
  },
  tvStand: {
    group: 'living', w: 160, d: 42, h: 130, front: 30,
    parts: [...cabinetParts(160, 42, 45, 'walnut', 3, 'black'), b(0, 0, 45, 160, 42, 2, 'walnut'), b(68, 14, 47, 24, 14, 3, 'black'), b(76, 19, 50, 8, 4, 8, 'black'), b(14, 18, 54, 132, 5, 76, 'black'), b(16, 23, 56, 128, 0.6, 72, 'screen')],
  },
  bookshelf: {
    group: 'living', w: 90, d: 32, h: 200, front: 40,
    parts: [
      b(0, 0, 0, 2.5, 32, 200, 'oak'), b(87.5, 0, 0, 2.5, 32, 200, 'oak'), b(2.5, 0, 0, 85, 1.5, 200, 'oak'),
      ...[0, 40, 80, 120, 160, 197.5].map((z) => b(2.5, 1.5, z, 85, 30.5, 2.5, 'oak')),
      ...[2.5, 42.5, 82.5, 122.5].flatMap((z, i) => [
        b(6, 6, z, 22 + (i % 2) * 6, 22, 27, 'bookA'),
        b(31 + (i % 2) * 6, 7, z, 18, 21, 24, 'bookB'),
        b(56, 6, z, 26 - (i % 2) * 8, 22, 21 + (i % 3) * 4, 'bookC'),
      ]),
      c(45, 16, 162.5, 9, 14, 'pot'),
    ],
  },
  plant: {
    group: 'living', w: 46, d: 46, h: 125,
    parts: [c(23, 23, 0, 15, 34, 'pot', 19), c(23, 23, 34, 2, 30, 'walnut'), s(23, 23, 78, 22, 'green'), s(17, 19, 98, 16, 'green'), s(30, 27, 104, 16, 'green')],
  },
  floorLamp: {
    group: 'living', w: 40, d: 40, h: 162,
    parts: [c(20, 20, 0, 14, 2.5, 'black'), c(20, 20, 2.5, 1.4, 128, 'black'), c(20, 20, 130, 19, 30, 'lampshade', 13)],
  },
  rug: { group: 'living', w: 200, d: 140, h: 1, flat: true, parts: [b(0, 0, 0, 200, 140, 1, 'rug')] },

  // Спальня
  bedDouble: { group: 'bedroom', w: 170, d: 210, h: 105, parts: bedParts(170) },
  bedSingle: { group: 'bedroom', w: 100, d: 210, h: 105, parts: bedParts(100) },
  nightstand: {
    group: 'bedroom', w: 45, d: 40, h: 82,
    parts: [...legs(45, 40, 10, 'black', 3, 3), b(0, 0, 10, 45, 38, 40, 'oak'), b(1, 38, 12, 43, 2, 17, 'oak'), b(1, 38, 31, 43, 2, 17, 'oak'), b(17, 40, 20, 11, 1.5, 1.5, 'black'), b(17, 40, 39, 11, 1.5, 1.5, 'black'), c(22, 18, 50, 7, 2, 'black'), c(22, 18, 52, 1, 16, 'black'), c(22, 18, 66, 11, 15, 'lampshade', 8)],
  },
  wardrobe: { group: 'bedroom', w: 180, d: 60, h: 225, front: 60, parts: cabinetParts(180, 60, 225, 'white', 3) },
  desk: {
    group: 'bedroom', w: 120, d: 60, h: 115,
    parts: [b(0, 0, 0, 3, 60, 71, 'oak'), b(117, 0, 0, 3, 60, 71, 'oak'), b(3, 2, 30, 114, 2, 41, 'oak'), b(80, 4, 28, 37, 54, 43, 'white'), b(0, 0, 71, 120, 60, 4, 'oak'), b(30, 22, 75, 34, 24, 1.5, 'steel'), b(30, 20, 76.5, 34, 1.5, 22, 'black'), c(98, 16, 75, 7, 2, 'black'), c(98, 16, 77, 1, 30, 'black'), c(98, 16, 105, 9, 10, 'lampshade', 6)],
  },
  chair: {
    group: 'bedroom', w: 46, d: 50, h: 88,
    parts: [...legs(46, 50, 43, 'oak', 2, 3.5), b(0, 4, 43, 46, 46, 5, 'fabricDark'), b(2, 2, 48, 3.5, 3.5, 40, 'oak'), b(40.5, 2, 48, 3.5, 3.5, 40, 'oak'), b(1, 1, 62, 44, 5, 26, 'fabricDark')],
  },
  dresser: {
    group: 'bedroom', w: 100, d: 45, h: 101, front: 50,
    parts: [...legs(100, 45, 10, 'black', 4, 3), b(0, 0, 10, 100, 43, 73, 'oak'), ...[12, 36.5, 61].map((z) => b(1, 43, z, 98, 2, 22.5, 'oak')), ...[22, 46.5, 71].map((z) => b(40, 45, z, 20, 1.5, 1.5, 'black')), b(0, 0, 83, 100, 45, 2, 'oak'), c(78, 20, 85, 8, 16, 'pot')],
  },

  // Кухня
  counter: { group: 'kitchen', w: 60, d: 61, h: 90, front: 70, parts: kitchenBase(60) },
  sinkUnit: {
    group: 'kitchen', w: 80, d: 61, h: 112, front: 70,
    parts: [...kitchenBase(80), b(14, 14, 90, 52, 38, 0.6, 'steel'), b(18, 18, 90.6, 44, 30, 0.4, 'burner'), c(40, 7, 90, 2.2, 3, 'chrome'), c(40, 7, 93, 1.3, 19, 'chrome'), b(38.7, 7, 110, 2.6, 16, 2, 'chrome')],
  },
  stove: {
    group: 'kitchen', w: 60, d: 61, h: 91, front: 70,
    parts: [b(0, 5, 0, 60, 50, 10, 'black'), b(0, 0, 10, 60, 56, 76, 'steel'), b(4, 56, 18, 52, 2, 48, 'black'), b(8, 58, 62, 44, 2.5, 2, 'chrome'), b(0, 56, 72, 60, 2, 12, 'steel'), ...[10, 22, 38, 50].map((x) => c(x, 58.5, 76, 2, 4, 'black')), b(0, 0, 86, 60, 61, 4, 'screen'), c(17, 18, 90, 9, 0.5, 'burner'), c(43, 18, 90, 7, 0.5, 'burner'), c(17, 43, 90, 7, 0.5, 'burner'), c(43, 43, 90, 9, 0.5, 'burner')],
  },
  fridge: {
    group: 'kitchen', w: 60, d: 66, h: 190, front: 60,
    parts: [b(0, 0, 0, 60, 60, 190, 'steel'), b(0.5, 60, 2, 59, 4, 62, 'steel'), b(0.5, 60, 66, 59, 4, 122, 'steel'), b(52, 64, 30, 2, 2.5, 30, 'chrome'), b(52, 64, 92, 2, 2.5, 46, 'chrome')],
  },
  diningTable: {
    group: 'kitchen', w: 120, d: 80, h: 94,
    parts: [...legs(120, 80, 72, 'oak', 5, 6), b(0, 0, 72, 120, 80, 4, 'oak'), c(60, 40, 76, 11, 3, 'ceramic'), s(60, 40, 86, 8, 'green')],
  },

  // Санузел
  toilet: {
    group: 'bathroom', w: 38, d: 68, h: 80, front: 50,
    parts: [b(1, 0, 38, 36, 18, 40, 'ceramic'), b(9, 4, 78, 20, 10, 2, 'chrome'), b(9, 14, 0, 20, 36, 34, 'ceramic'), c(19, 45, 20, 17, 18, 'ceramic', 19), c(19, 45, 38, 19, 2.5, 'ceramic'), c(19, 45, 40.5, 14, 0.4, 'basin')],
  },
  bathtub: {
    group: 'bathroom', w: 170, d: 75, h: 72, front: 40,
    parts: [b(0, 0, 0, 170, 7, 58, 'ceramic'), b(0, 68, 0, 170, 7, 58, 'ceramic'), b(0, 7, 0, 7, 61, 58, 'ceramic'), b(163, 7, 0, 7, 61, 58, 'ceramic'), b(7, 7, 0, 156, 61, 16, 'basin'), c(18, 3.5, 58, 2, 14, 'chrome'), b(16.7, 3.5, 70, 2.6, 16, 2, 'chrome'), c(150, 37, 16, 2.5, 0.5, 'chrome')],
  },
  shower: {
    group: 'bathroom', w: 90, d: 90, h: 205, front: 45,
    parts: [b(0, 0, 0, 90, 90, 8, 'ceramic'), b(6, 6, 8, 78, 78, 0.4, 'basin'), b(0, 88.5, 8, 90, 1.5, 192, 'glass'), b(88.5, 0, 8, 1.5, 88.5, 192, 'glass'), c(88.5, 88.5, 8, 1.5, 192, 'chrome'), c(8, 8, 8, 1.5, 192, 'chrome'), b(6, 6, 198, 20, 20, 2, 'chrome'), b(84, 40, 100, 6, 2.5, 30, 'chrome')],
  },
  washbasin: {
    group: 'bathroom', w: 60, d: 48, h: 180, front: 50,
    parts: [b(0, 0, 28, 60, 44, 44, 'walnut'), b(1, 44, 30, 58, 2, 40, 'walnut'), b(22, 46, 60, 16, 1.5, 1.5, 'chrome'), b(0, 0, 72, 60, 48, 12, 'ceramic'), b(8, 12, 84, 44, 30, 0.4, 'basin'), c(30, 6, 84, 2, 3, 'chrome'), c(30, 6, 87, 1.2, 14, 'chrome'), b(28.8, 6, 99, 2.4, 13, 1.8, 'chrome'), b(4, 0, 108, 52, 2, 72, 'mirror')],
  },
  washingMachine: {
    group: 'bathroom', w: 60, d: 57, h: 85, front: 50,
    parts: [b(0, 0, 0, 60, 54, 85, 'white'), b(0, 54, 70, 60, 1.5, 15, 'cabinet'), b(34, 55.5, 74, 20, 1, 6, 'screen'), c(12, 55.5, 77, 3.5, 3.5, 'chrome'), b(13, 54, 20, 34, 2, 34, 'chrome'), b(17, 56, 24, 26, 1, 26, 'screen')],
  },

  // Прихожая
  wardrobeHall: {
    group: 'hall', w: 100, d: 45, h: 215, front: 50,
    parts: [...cabinetParts(100, 45, 215, 'white', 2), b(4, 45, 20, 42, 0.5, 180, 'mirror')],
  },
  shoeCabinet: {
    group: 'hall', w: 80, d: 34, h: 112, front: 40,
    parts: [...legs(80, 34, 12, 'black', 3, 3), b(0, 0, 12, 80, 32, 86, 'oak'), b(1, 32, 14, 78, 2, 40, 'oak'), b(1, 32, 56, 78, 2, 40, 'oak'), b(30, 34, 46, 20, 1.5, 1.5, 'black'), b(30, 34, 88, 20, 1.5, 1.5, 'black'), b(0, 0, 98, 80, 34, 2, 'oak'), c(60, 16, 100, 7, 12, 'pot')],
  },
};

// top — детали для вида сверху: без мелочей, от нижних к верхним.
export const CATALOG = Object.fromEntries(
  Object.entries(DEFS).map(([type, def]) => {
    const height = (p) => (p.shape === 'box' ? p.z + p.sz : p.shape === 'cyl' ? p.z + p.h : p.z + p.r);
    const visible = (p) => (p.shape === 'box' ? p.sx >= 2.5 && p.sy >= 2.5 : p.r >= 2.5);
    const top = def.parts.filter(visible).sort((p, q) => height(p) - height(q));
    return [type, { type, ...def, top }];
  }),
);

export const GROUPS = ['living', 'bedroom', 'kitchen', 'bathroom', 'hall'];
const DOOR_CLEAR = 85; // свободная зона перед дверью, от оси стены
const isFlat = (item) => Boolean(CATALOG[item.type]?.flat);

/* ---------- Геометрия ---------- */

const hit = (p, q) => p.x0 < q.x1 - 1e-6 && q.x0 < p.x1 - 1e-6 && p.y0 < q.y1 - 1e-6 && q.y0 < p.y1 - 1e-6;
const normRot = (rot) => (((Math.round(rot / 90) * 90) % 360) + 360) % 360;

// Локальный вектор (u — вправо, v — к лицевой стороне) → вектор на плане.
function rotate(rot, u, v) {
  switch (normRot(rot)) {
    case 0: return [u, v];
    case 90: return [-v, u];
    case 180: return [-u, -v];
    default: return [v, -u];
  }
}

// Прямоугольник на плане по двум углам в локальных координатах предмета (от его центра).
function localRect(item, u0, v0, u1, v1) {
  const [ax, ay] = rotate(item.rot, u0, v0);
  const [bx, by] = rotate(item.rot, u1, v1);
  return {
    x0: item.x + Math.min(ax, bx),
    y0: item.y + Math.min(ay, by),
    x1: item.x + Math.max(ax, bx),
    y1: item.y + Math.max(ay, by),
  };
}

// Пятно предмета на плане.
export function footprint(item) {
  const { w, d } = CATALOG[item.type];
  return localRect(item, -w / 2, -d / 2, w / 2, d / 2);
}

// Зона перед лицевой стороной, которую лучше не занимать (дверцы, подход).
export function frontZone(item) {
  const { w, d, front } = CATALOG[item.type];
  return front ? localRect(item, -w / 2, d / 2, w / 2, d / 2 + front) : null;
}

// Внутренний контур комнаты — между гранями стен.
export function roomInterior(plan, room) {
  const half = (outer) => (outer ? OUTER_T : INNER_T) / 2;
  return {
    x0: room.x + half(room.x === 0),
    y0: room.y + half(room.y === 0),
    x1: room.x + room.w - half(room.x + room.w === plan.width),
    y1: room.y + room.l - half(room.y + room.l === plan.length),
  };
}

// Зоны перед дверями, которые нельзя заставлять: [{ roomId, rect, x, y }], (x, y) — точка подхода.
export function doorZones(plan, walls = buildWalls(plan)) {
  const zones = [];
  for (const o of plan.openings) {
    if (o.type === 'window') continue;
    const wall = wallOfOpening(o, walls);
    if (!wall) continue;
    for (const [roomId, sign] of [[wall.a, -1], [wall.b, 1]]) {
      if (roomId === null) continue;
      const lo = sign < 0 ? -DOOR_CLEAR : 0;
      const hi = sign < 0 ? 0 : DOOR_CLEAR;
      const mid = (o.dir === 'h' ? o.x : o.y) + o.width / 2;
      zones.push(
        o.dir === 'h'
          ? { roomId, rect: { x0: o.x - 5, y0: o.y + lo, x1: o.x + o.width + 5, y1: o.y + hi }, x: mid, y: o.y + sign * 50 }
          : { roomId, rect: { x0: o.x + lo, y0: o.y - 5, x1: o.x + hi, y1: o.y + o.width + 5 }, x: o.x + sign * 50, y: mid },
      );
    }
  }
  return zones;
}

// Можно ли пройти между всеми дверями комнаты, если в ней стоят rects.
function passageOk(interior, rects, zones) {
  if (!zones.length) return true;
  const step = 10;
  const R = PLAYER_R + 1;
  const x0 = interior.x0 + PLAYER_R;
  const y0 = interior.y0 + PLAYER_R;
  const cols = Math.floor((interior.x1 - PLAYER_R - x0) / step) + 1;
  const rows = Math.floor((interior.y1 - PLAYER_R - y0) / step) + 1;
  if (cols < 1 || rows < 1) return true;
  const blocked = new Uint8Array(cols * rows);
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const cx = x0 + i * step;
      const cy = y0 + j * step;
      if (rects.some((r) => cx > r.x0 - R && cx < r.x1 + R && cy > r.y0 - R && cy < r.y1 + R)) blocked[j * cols + i] = 1;
    }
  }
  const cell = (z) => {
    const i = Math.min(cols - 1, Math.max(0, Math.round((z.x - x0) / step)));
    const j = Math.min(rows - 1, Math.max(0, Math.round((z.y - y0) / step)));
    return j * cols + i;
  };
  const targets = zones.map(cell);
  if (targets.some((k) => blocked[k])) return false;
  const seen = new Uint8Array(cols * rows);
  const stack = [targets[0]];
  seen[targets[0]] = 1;
  while (stack.length) {
    const k = stack.pop();
    const i = k % cols;
    for (const n of [i > 0 ? k - 1 : -1, i < cols - 1 ? k + 1 : -1, k - cols, k + cols]) {
      if (n >= 0 && n < seen.length && !seen[n] && !blocked[n]) {
        seen[n] = 1;
        stack.push(n);
      }
    }
  }
  return targets.every((k) => seen[k]);
}

/* ---------- Правила расстановки ---------- */

// Можно ли поставить item среди items. → { ok, reason }
// reason: 'type' | 'bounds' — не помещается в комнате | 'overlap' — занято |
// 'door' — загораживает дверь | 'passage' — перекрывает проход между дверями.
export function canPlace(plan, items, item) {
  const fail = (reason) => ({ ok: false, reason });
  const def = CATALOG[item.type];
  if (!def || ![item.x, item.y].every(Number.isFinite) || normRot(item.rot) !== item.rot) return fail('type');
  const room = roomAt(plan, item.x, item.y);
  if (!room) return fail('bounds');
  const inner = roomInterior(plan, room);
  const fp = footprint(item);
  const eps = 0.01;
  if (fp.x0 < inner.x0 - eps || fp.y0 < inner.y0 - eps || fp.x1 > inner.x1 + eps || fp.y1 > inner.y1 + eps) return fail('bounds');
  if (def.flat) return { ok: true, reason: null };

  const others = items.filter((o) => o.id !== item.id && CATALOG[o.type] && !isFlat(o)).map(footprint);
  if (others.some((r) => hit(r, fp))) return fail('overlap');
  const zones = doorZones(plan).filter((z) => z.roomId === room.id);
  if (zones.some((z) => hit(z.rect, fp))) return fail('door');
  const inRoom = others.filter((r) => hit(r, inner));
  if (!passageOk(inner, [...inRoom, fp], zones)) return fail('passage');
  return { ok: true, reason: null };
}

// Оставляет только предметы, которые можно поставить (например, после смены планировки).
export function sanitizeFurniture(plan, items) {
  const kept = [];
  for (const raw of Array.isArray(items) ? items : []) {
    if (!raw || typeof raw !== 'object') continue;
    const item = { id: String(raw.id), type: raw.type, x: raw.x, y: raw.y, rot: raw.rot };
    if (kept.some((k) => k.id === item.id)) continue;
    if (canPlace(plan, kept, item).ok) kept.push(item);
  }
  return kept;
}

// Препятствия для прогулки: пятна всех предметов, кроме ковров.
export function furnitureColliders(items) {
  return items.filter((item) => CATALOG[item.type] && !isFlat(item)).map(footprint);
}

/* ---------- Случайная обстановка ---------- */

const SIDES = ['top', 'right', 'bottom', 'left'];
const SIDE_ROT = { top: 0, right: 90, bottom: 180, left: 270 };
const OPPOSITE = { top: 'bottom', bottom: 'top', left: 'right', right: 'left' };

// Окна комнаты по сторонам: { top: [[от, до], …], … }.
function windowsOf(plan, room, walls) {
  const out = { top: [], right: [], bottom: [], left: [] };
  for (const o of plan.openings) {
    if (o.type !== 'window') continue;
    const wall = wallOfOpening(o, walls);
    if (!wall || (wall.a ?? wall.b) !== room.id) continue;
    if (o.dir === 'h') out[o.y === room.y ? 'top' : 'bottom'].push([o.x, o.x + o.width]);
    else out[o.x === room.x ? 'left' : 'right'].push([o.y, o.y + o.width]);
  }
  return out;
}

function furnishRoom(plan, room, items, rng, walls, newId) {
  const inner = roomInterior(plan, room);
  const windows = windowsOf(plan, room, walls);
  const keepClear = doorZones(plan, walls).filter((z) => z.roomId === room.id).map((z) => z.rect);
  const area = (room.w * room.l) / 10000;
  const maybe = (p) => rng() < p;

  // relative — предмет ставится относительно другого (стул у стола) и может занять его зону подхода.
  function tryAdd(item, relative = false) {
    const def = CATALOG[item.type];
    const zone = frontZone(item);
    if (!def.flat && !relative) {
      const fp = footprint(item);
      if (keepClear.some((r) => hit(r, fp))) return null;
      if (zone && items.some((o) => !isFlat(o) && hit(zone, footprint(o)))) return null;
    }
    if (!canPlace(plan, items, item).ok) return null;
    items.push(item);
    if (zone) keepClear.push(zone);
    return item;
  }

  // Спинкой к стене. align: 'center' | 'corner' | 'any' | число — желаемая координата вдоль стены.
  function wall(type, { align = 'any', sides = SIDES, avoidWindow = false, preferWindow = false } = {}) {
    const def = CATALOG[type];
    const candidates = [];
    for (const side of sides) {
      const horizontal = side === 'top' || side === 'bottom';
      const a0 = horizontal ? inner.x0 : inner.y0;
      const a1 = horizontal ? inner.x1 : inner.y1;
      for (let p = a0 + def.w / 2; p <= a1 - def.w / 2 + 1e-6; p += 5) {
        const lo = p - def.w / 2;
        const hi = p + def.w / 2;
        const overWindow = windows[side].some(([from, to]) => lo < to && from < hi);
        if (avoidWindow && overWindow) continue;
        let score;
        if (align === 'center') score = -Math.abs(p - (a0 + a1) / 2) + rng() * 30;
        else if (align === 'corner') score = -Math.min(lo - a0, a1 - hi) + rng() * 2;
        else if (typeof align === 'number') score = -Math.abs(p - align);
        else score = rng() * 300;
        if (preferWindow && overWindow) score += 200;
        const x = side === 'left' ? inner.x0 + def.d / 2 : side === 'right' ? inner.x1 - def.d / 2 : p;
        const y = side === 'top' ? inner.y0 + def.d / 2 : side === 'bottom' ? inner.y1 - def.d / 2 : p;
        candidates.push({ score, x, y, rot: SIDE_ROT[side] });
      }
    }
    candidates.sort((p, q) => q.score - p.score);
    for (const { x, y, rot } of candidates.slice(0, 80)) {
      const placed = tryAdd({ id: newId(), type, x, y, rot });
      if (placed) return placed;
    }
    return null;
  }

  // Рядом с anchor: смещение (du, dv) в его локальных координатах, поворот относительно него.
  function near(type, anchor, du, dv, turn = 0) {
    if (!anchor) return null;
    const [ox, oy] = rotate(anchor.rot, du, dv);
    return tryAdd({ id: newId(), type, x: anchor.x + ox, y: anchor.y + oy, rot: normRot(anchor.rot + turn) }, true);
  }

  // В свободном месте, как можно дальше от стен и мебели.
  function free(type, minGap) {
    const def = CATALOG[type];
    const solid = items.filter((o) => !isFlat(o)).map(footprint);
    const candidates = [];
    for (const rot of [0, 90]) {
      for (let x = inner.x0; x <= inner.x1; x += 15) {
        for (let y = inner.y0; y <= inner.y1; y += 15) {
          const fp = footprint({ type, x, y, rot });
          let gap = Math.min(fp.x0 - inner.x0, fp.y0 - inner.y0, inner.x1 - fp.x1, inner.y1 - fp.y1);
          for (const r of solid) gap = Math.min(gap, Math.max(r.x0 - fp.x1, fp.x0 - r.x1, r.y0 - fp.y1, fp.y0 - r.y1));
          if (gap >= minGap) candidates.push({ score: gap + rng() * 6, x, y, rot });
        }
      }
    }
    candidates.sort((p, q) => q.score - p.score);
    for (const { x, y, rot } of candidates.slice(0, 30)) {
      const placed = tryAdd({ id: newId(), type, x, y, rot });
      if (placed) return placed;
    }
    return null;
  }

  const size = (type) => CATALOG[type];
  const sideOf = (item) => SIDES.find((k) => SIDE_ROT[k] === item.rot);
  const alongOf = (item) => (item.rot % 180 === 0 ? item.x : item.y);

  if (room.type === 'living') {
    const sofa = wall('sofa', { align: 'center' }) || wall('armchair', { align: 'center' });
    if (sofa) {
      const table = sofa.type === 'sofa' ? near('coffeeTable', sofa, 0, size('sofa').d / 2 + 45 + size('coffeeTable').d / 2) : null;
      if (table) near('rug', table, 0, 0);
      wall('tvStand', { align: alongOf(sofa), sides: [OPPOSITE[sideOf(sofa)]] }) || wall('tvStand', { align: 'center', avoidWindow: true });
    }
    if (area > 15 && sofa?.type === 'sofa') wall('armchair', { align: 'corner' });
    wall('bookshelf', { align: 'corner', avoidWindow: true });
    wall('plant', { align: 'corner' });
    if (maybe(0.7)) wall('floorLamp', { align: 'corner' });
  }

  if (room.type === 'bedroom') {
    const big = Math.min(inner.x1 - inner.x0, inner.y1 - inner.y0) >= 280 && area >= 11.5;
    const types = big ? ['bedDouble', 'bedSingle'] : ['bedSingle'];
    let bed = null;
    for (const type of types) {
      bed = wall(type, { align: 'center', avoidWindow: true }) || wall(type, { align: 'corner' });
      if (bed) break;
    }
    if (bed) {
      const { w, d } = size(bed.type);
      const ns = size('nightstand');
      const du = w / 2 + ns.w / 2 + 3;
      const dv = -d / 2 + ns.d / 2;
      near('nightstand', bed, -du, dv);
      if (bed.type === 'bedDouble') near('nightstand', bed, du, dv);
      if (maybe(0.6)) near('rug', bed, 0, d / 2 - 30);
    }
    wall('wardrobe', { align: 'corner', avoidWindow: true });
    const desk = wall('desk', { preferWindow: true });
    near('chair', desk, 0, size('desk').d / 2 + size('chair').d / 2 + 4, 180);
    if (maybe(0.6)) wall('dresser', { align: 'any' });
    if (maybe(0.5)) wall('plant', { align: 'corner' });
  }

  if (room.type === 'kitchen') {
    // Гарнитур в линию: от холодильника в углу — модули вплотную друг к другу.
    let left = wall('fridge', { align: 'corner', avoidWindow: true });
    let right = left;
    for (const type of ['counter', 'sinkUnit', 'counter', 'stove', 'counter']) {
      if (!left) {
        left = right = wall(type, { align: 'corner' });
        continue;
      }
      const flush = (anchor) => -size(anchor.type).d / 2 + size(type).d / 2;
      const toRight = near(type, right, size(right.type).w / 2 + size(type).w / 2, flush(right));
      if (toRight) {
        right = toRight;
        continue;
      }
      const toLeft = near(type, left, -(size(left.type).w / 2 + size(type).w / 2), flush(left));
      if (toLeft) left = toLeft;
    }
    const table = free('diningTable', 55);
    if (table) {
      const dv = size('diningTable').d / 2 + size('chair').d / 2 + 3;
      for (const du of [-30, 30]) {
        near('chair', table, du, dv, 180);
        near('chair', table, du, -dv, 0);
      }
    }
    if (maybe(0.4)) wall('plant', { align: 'corner' });
  }

  if (room.type === 'bathroom') {
    wall('bathtub', { align: 'corner' }) || wall('shower', { align: 'corner' });
    wall('toilet', { align: 'any' });
    wall('washbasin', { align: 'center' });
    wall('washingMachine', { align: 'corner' });
  }

  if (room.type === 'hall') {
    wall('wardrobeHall', { align: 'corner' });
    wall('shoeCabinet', { align: 'any' });
    if (maybe(0.4)) wall('plant', { align: 'corner' });
  }
}

// Обставляет всю квартиру. Один и тот же seed даёт одну и ту же обстановку.
export function autoFurnish(plan, seed = 1) {
  const rng = mulberry32(seed);
  const walls = buildWalls(plan);
  const items = [];
  let n = 0;
  const newId = () => `f${++n}`;
  for (const room of plan.rooms) furnishRoom(plan, room, items, rng, walls, newId);
  return items;
}
