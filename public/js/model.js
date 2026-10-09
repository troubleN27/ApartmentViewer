// Геометрия квартиры: площади, стены, проёмы, валидация, коллизии.
// Чистые функции без DOM. Все размеры в сантиметрах.

export const OUTER_T = 25; // толщина внешней стены
export const INNER_T = 10; // толщина внутренней стены
export const DOOR_H = 210;
export const SILL_H = 80;
export const WINDOW_H = 150;
export const ENTRANCE_W = 90;
export const PLAYER_R = 25;
export const MIN_PASS = 50; // минимальная ширина проёма, в который проходит игрок
export const TRIM_T = 1.5; // толщина плинтуса и наличника
export const BASEBOARD_H = 8;
export const CASING_W = 7; // ширина наличника
export const FRAME_W = 5; // ширина профиля оконной рамы

export const ROOM_TYPES = ['living', 'bedroom', 'kitchen', 'bathroom', 'hall'];
export const OPENING_TYPES = ['door', 'entrance', 'window'];
const NEED_WINDOW = ['living', 'bedroom', 'kitchen'];

const isInt = (v) => Number.isInteger(v);
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
// Координата вдоль линии стены/проёма и поперёк неё.
const along = (o) => (o.dir === 'h' ? o.x : o.y);
const across = (o) => (o.dir === 'h' ? o.y : o.x);

/* ---------- Площади и цены ---------- */

export function roomArea(room) {
  return (room.w * room.l) / 10000;
}

export function planArea(plan) {
  return plan.rooms.reduce((sum, r) => sum + r.w * r.l, 0) / 10000;
}

export function calcPrice(area, pricePerM2) {
  return Math.round(area * pricePerM2);
}

// 63.04 → "63,0"
export function formatArea(area) {
  return area.toFixed(1).replace('.', ',');
}

// 1250000000 → "1 250 000 000"
export function formatPrice(value) {
  return String(Math.round(value)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

// Число «жилых» комнат (комнатность квартиры).
export function countLivingRooms(plan) {
  return plan.rooms.filter((r) => r.type === 'living' || r.type === 'bedroom').length;
}

export function roomAt(plan, x, y) {
  return plan.rooms.find((r) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.l) || null;
}

/* ---------- Стены ---------- */

// Стены по границам комнат. Каждый сегмент разделяет ровно одну пару (a, b):
// a — комната сверху/слева от линии, b — снизу/справа, null — снаружи.
// { id, dir, x, y, len, kind: 'outer'|'inner', t, a, b, from, to }
// from..to — глухая часть стены вдоль линии: в узлах, где сходятся стены разных
// направлений, стоит столбик (wallPosts), и стена укорочена на его половину.
// Так объёмы стен нигде не перекрываются.
export function buildWalls(plan) {
  const walls = [];
  for (const dir of ['h', 'v']) {
    const v = dir === 'v';
    const pos = (r) => (v ? r.x : r.y);
    const size = (r) => (v ? r.w : r.l);
    const from = (r) => (v ? r.y : r.x);
    const span = (r) => (v ? r.l : r.w);

    const lines = new Set();
    plan.rooms.forEach((r) => lines.add(pos(r)).add(pos(r) + size(r)));

    for (const c of [...lines].sort((p, q) => p - q)) {
      const before = plan.rooms.filter((r) => pos(r) + size(r) === c);
      const after = plan.rooms.filter((r) => pos(r) === c);
      const points = new Set();
      [...before, ...after].forEach((r) => points.add(from(r)).add(from(r) + span(r)));
      const sorted = [...points].sort((p, q) => p - q);

      let cur = null;
      for (let i = 0; i < sorted.length - 1; i++) {
        const s = sorted[i];
        const e = sorted[i + 1];
        const covers = (r) => from(r) <= s && from(r) + span(r) >= e;
        const a = before.find(covers)?.id ?? null;
        const b = after.find(covers)?.id ?? null;
        if (a === null && b === null) {
          cur = null;
          continue;
        }
        if (cur && cur.a === a && cur.b === b && along(cur) + cur.len === s) {
          cur.len += e - s;
          continue;
        }
        const outer = a === null || b === null;
        cur = {
          id: `w${walls.length + 1}`,
          dir,
          x: v ? c : s,
          y: v ? s : c,
          len: e - s,
          kind: outer ? 'outer' : 'inner',
          t: outer ? OUTER_T : INNER_T,
          a,
          b,
        };
        walls.push(cur);
      }
    }
  }
  const nodes = wallNodes(walls);
  for (const w of walls) {
    const s = along(w);
    const e = s + w.len;
    const n0 = nodes.get(w.dir === 'h' ? `${s},${w.y}` : `${w.x},${s}`);
    const n1 = nodes.get(w.dir === 'h' ? `${e},${w.y}` : `${w.x},${e}`);
    w.from = s + (w.dir === 'h' ? n0.tv : n0.th) / 2;
    w.to = e - (w.dir === 'h' ? n1.tv : n1.th) / 2;
  }
  return walls;
}

// Узлы — концы стен. th — наибольшая толщина горизонтальных стен в узле, tv — вертикальных.
function wallNodes(walls) {
  const nodes = new Map();
  for (const w of walls) {
    const e = along(w) + w.len;
    for (const [x, y] of [[w.x, w.y], w.dir === 'h' ? [e, w.y] : [w.x, e]]) {
      const key = `${x},${y}`;
      if (!nodes.has(key)) nodes.set(key, { x, y, th: 0, tv: 0, covered: {} });
      const node = nodes.get(key);
      if (w.dir === 'h') node.th = Math.max(node.th, w.t);
      else node.tv = Math.max(node.tv, w.t);
      // С какой стороны узла уходит стена: эта грань столбика закрыта.
      const start = x === w.x && y === w.y;
      node.covered[w.dir === 'h' ? (start ? 'xp' : 'xn') : start ? 'yp' : 'yn'] = true;
    }
  }
  return nodes;
}

// Столбики в узлах, где сходятся горизонтальные и вертикальные стены.
// { x0, y0, x1, y1, faces: { xn, xp, yn, yp } } — faces: id комнаты (или null — улица),
// к которой обращена грань с этой стороны (xn — в сторону −X и т. д.).
// У граней, закрытых примыкающей стеной, значения нет (undefined).
export function wallPosts(plan, walls = buildWalls(plan)) {
  const side = (x, y) => roomAt(plan, x, y)?.id ?? null;
  const posts = [];
  for (const { x, y, th, tv, covered } of wallNodes(walls).values()) {
    if (!th || !tv) continue;
    const face = (key, px, py) => (covered[key] ? undefined : side(px, py));
    posts.push({
      x0: x - tv / 2,
      y0: y - th / 2,
      x1: x + tv / 2,
      y1: y + th / 2,
      faces: { xn: face('xn', x - tv, y), xp: face('xp', x + tv, y), yn: face('yn', x, y - th), yp: face('yp', x, y + th) },
    });
  }
  return posts;
}

// Стена, на которой целиком лежит проём, либо null.
export function wallOfOpening(opening, walls) {
  return (
    walls.find(
      (w) =>
        w.dir === opening.dir &&
        across(w) === across(opening) &&
        along(opening) >= along(w) &&
        along(opening) + opening.width <= along(w) + w.len,
    ) || null
  );
}

// Прямоугольник отрезка стены [from, to] вдоль её линии, толщиной t.
function pieceRect(wall, from, to, t = wall.t) {
  const c = across(wall);
  return wall.dir === 'h'
    ? { x0: from, y0: c - t / 2, x1: to, y1: c + t / 2 }
    : { x0: c - t / 2, y0: from, x1: c + t / 2, y1: to };
}

// Прямоугольник глухой части стены в плане (между столбиками в узлах).
export function wallRect(wall) {
  return pieceRect(wall, wall.from, wall.to);
}

// Делит стену на куски вдоль линии: глухие участки и проёмы.
// → [{ from, to, opening: null | opening }]
export function splitWall(wall, openings) {
  const own = openings
    .filter((o) => wallOfOpening(o, [wall]))
    .sort((p, q) => along(p) - along(q));
  const end = wall.to;
  const pieces = [];
  let cursor = wall.from;
  for (const o of own) {
    const s = along(o);
    if (s > cursor) pieces.push({ from: cursor, to: s, opening: null });
    pieces.push({ from: s, to: s + o.width, opening: o });
    cursor = Math.max(cursor, s + o.width);
  }
  if (end > cursor) pieces.push({ from: cursor, to: end, opening: null });
  return pieces;
}

// Объёмы для 3D: { x0, y0, x1, y1 (план), z0, z1 (высота), kind, wallKind, faces }.
// faces — к какой комнате обращена каждая сторона (см. wallPosts): по ним 3D выбирает отделку.
// Объёмы не перекрываются — иначе совпадающие грани мерцают.
// kind: 'wall' — стена, перемычка или подоконная часть; 'glass' — стекло; 'entrance' — полотно входной двери.
export function wallBoxes(plan) {
  const boxes = [];
  const h = plan.height;
  const walls = buildWalls(plan);
  for (const post of wallPosts(plan, walls)) boxes.push({ ...post, z0: 0, z1: h, kind: 'wall', wallKind: 'post' });
  for (const wall of walls) {
    const faces = wall.dir === 'h' ? { yn: wall.a, yp: wall.b } : { xn: wall.a, xp: wall.b };
    const box = (from, to, z0, z1, kind = 'wall', t) => {
      if (z1 > z0 && to > from) boxes.push({ ...pieceRect(wall, from, to, t), z0, z1, kind, wallKind: wall.kind, faces });
    };
    for (const { from, to, opening } of splitWall(wall, plan.openings)) {
      if (!opening) {
        box(from, to, 0, h);
      } else if (opening.type === 'window') {
        box(from, to, 0, SILL_H);
        box(from, to, SILL_H + WINDOW_H, h);
        box(from, to, SILL_H, Math.min(h, SILL_H + WINDOW_H), 'glass', 2);
      } else {
        box(from, to, DOOR_H, h);
        if (opening.type === 'entrance') box(from, to, 0, Math.min(h, DOOR_H), 'entrance', 6);
      }
    }
  }
  return boxes;
}

// Отделочные детали для 3D — по ним глаз считывает масштаб комнаты.
// → [{ x0, y0, x1, y1, z0, z1, kind }], kind:
// 'baseboard' — плинтус вдоль стен комнаты, 'casing' — наличник двери,
// 'frame' — профиль оконной рамы в проёме, 'sill' — подоконник.
export function trimBoxes(plan) {
  const out = [];
  const h = plan.height;
  const walls = buildWalls(plan);
  const push = (kind, rect, z0, z1) => {
    if (z1 > z0 && rect.x1 > rect.x0 && rect.y1 > rect.y0) out.push({ ...rect, z0, z1, kind });
  };
  // Полоса на грани стены со стороны side (−1 — к комнате a, +1 — к комнате b), выступает на depth.
  const onFace = (wall, side, from, to, depth = TRIM_T) => {
    const c = across(wall) + (side * wall.t) / 2;
    const [lo, hi] = side < 0 ? [c - depth, c] : [c, c + depth];
    return wall.dir === 'h' ? { x0: from, y0: lo, x1: to, y1: hi } : { x0: lo, y0: from, x1: hi, y1: to };
  };

  for (const wall of walls) {
    const sides = [];
    if (wall.a !== null) sides.push(-1);
    if (wall.b !== null) sides.push(1);
    for (const { from, to, opening } of splitWall(wall, plan.openings)) {
      const isWindow = opening?.type === 'window';
      const isDoor = opening && !isWindow;
      for (const side of sides) {
        if (!isDoor) {
          push('baseboard', onFace(wall, side, from, to), 0, BASEBOARD_H);
        } else {
          const top = Math.min(h, DOOR_H + CASING_W);
          push('casing', onFace(wall, side, Math.max(wall.from, from - CASING_W), from), 0, top);
          push('casing', onFace(wall, side, to, Math.min(wall.to, to + CASING_W)), 0, top);
          push('casing', onFace(wall, side, from, to), DOOR_H, top);
        }
        if (isWindow) {
          push('sill', onFace(wall, side, Math.max(wall.from, from - 5), Math.min(wall.to, to + 5), 12), SILL_H - 3, SILL_H);
        }
      }
      if (isWindow) {
        const top = Math.min(h, SILL_H + WINDOW_H);
        const bar = (a, b, z0, z1) => push('frame', pieceRect(wall, a, b, 6), z0, z1);
        bar(from, from + FRAME_W, SILL_H, top);
        bar(to - FRAME_W, to, SILL_H, top);
        bar(from + FRAME_W, to - FRAME_W, SILL_H, SILL_H + FRAME_W);
        bar(from + FRAME_W, to - FRAME_W, top - FRAME_W, top);
        // Импост посередине широкого окна.
        const mid = (from + to) / 2;
        if (to - from >= 100) bar(mid - 2, mid + 2, SILL_H + FRAME_W, top - FRAME_W);
      }
    }
  }

  // Плинтус на открытых гранях столбиков, обращённых в комнату.
  for (const p of wallPosts(plan, walls)) {
    const strips = {
      xn: { x0: p.x0 - TRIM_T, y0: p.y0, x1: p.x0, y1: p.y1 },
      xp: { x0: p.x1, y0: p.y0, x1: p.x1 + TRIM_T, y1: p.y1 },
      yn: { x0: p.x0, y0: p.y0 - TRIM_T, x1: p.x1, y1: p.y0 },
      yp: { x0: p.x0, y0: p.y1, x1: p.x1, y1: p.y1 + TRIM_T },
    };
    for (const key in strips) {
      if (typeof p.faces[key] === 'string') push('baseboard', strips[key], 0, BASEBOARD_H);
    }
  }
  return out;
}

/* ---------- Достижимость ---------- */

// Граф комнат: рёбра — двери, в которые проходит игрок. → Map(roomId → Set(roomId))
export function roomGraph(plan, walls = buildWalls(plan)) {
  const graph = new Map(plan.rooms.map((r) => [r.id, new Set()]));
  for (const o of plan.openings) {
    if (o.type !== 'door' || o.width < MIN_PASS) continue;
    const w = wallOfOpening(o, walls);
    if (!w || w.a === null || w.b === null) continue;
    graph.get(w.a).add(w.b);
    graph.get(w.b).add(w.a);
  }
  return graph;
}

// Комната, в которую ведёт входная дверь (id) либо null.
export function entranceRoom(plan, walls = buildWalls(plan)) {
  const entrance = plan.openings.find((o) => o.type === 'entrance');
  const wall = entrance && wallOfOpening(entrance, walls);
  return wall ? wall.a ?? wall.b : null;
}

// Множество id комнат, достижимых от входной двери.
export function reachableRooms(plan, walls = buildWalls(plan)) {
  const start = entranceRoom(plan, walls);
  const seen = new Set();
  if (start === null) return seen;
  const graph = roomGraph(plan, walls);
  const queue = [start];
  seen.add(start);
  while (queue.length) {
    for (const next of graph.get(queue.shift())) {
      if (!seen.has(next)) {
        seen.add(next);
        queue.push(next);
      }
    }
  }
  return seen;
}

/* ---------- Валидация ---------- */

function formatOk(plan) {
  if (!plan || typeof plan !== 'object') return false;
  if (![plan.width, plan.length, plan.height].every((v) => isInt(v) && v > 0)) return false;
  if (!Array.isArray(plan.rooms) || !plan.rooms.length || !Array.isArray(plan.openings)) return false;
  const ids = new Set();
  for (const r of plan.rooms) {
    if (!r || typeof r.id !== 'string' || ids.has(r.id) || !ROOM_TYPES.includes(r.type)) return false;
    if (![r.x, r.y, r.w, r.l].every(isInt) || r.w <= 0 || r.l <= 0) return false;
    ids.add(r.id);
  }
  return plan.openings.every(
    (o) =>
      o &&
      OPENING_TYPES.includes(o.type) &&
      (o.dir === 'h' || o.dir === 'v') &&
      [o.x, o.y, o.width].every(isInt) &&
      o.width > 0,
  );
}

// → { ok, errors: [{ code, message }] }
export function validatePlan(plan) {
  const errors = [];
  const add = (code, message) => errors.push({ code, message });
  const done = () => ({ ok: errors.length === 0, errors });

  if (!formatOk(plan)) {
    add('BAD_FORMAT', 'Некорректный формат плана');
    return done();
  }

  // Комнаты: внутри контура, без пересечений, покрывают его целиком.
  const { rooms, openings, width, length } = plan;
  for (const r of rooms) {
    if (r.x < 0 || r.y < 0 || r.x + r.w > width || r.y + r.l > length) {
      add('OUT_OF_BOUNDS', `Комната ${r.id} выходит за контур квартиры`);
    }
  }
  for (let i = 0; i < rooms.length; i++) {
    for (let j = i + 1; j < rooms.length; j++) {
      const p = rooms[i];
      const q = rooms[j];
      if (p.x < q.x + q.w && q.x < p.x + p.w && p.y < q.y + q.l && q.y < p.y + p.l) {
        add('OVERLAP', `Комнаты ${p.id} и ${q.id} пересекаются`);
      }
    }
  }
  if (!errors.length && rooms.reduce((s, r) => s + r.w * r.l, 0) !== width * length) {
    add('NOT_COVERED', 'Комнаты не покрывают квартиру целиком');
  }
  if (errors.length) return done();

  // Проёмы: на стене, нужного типа стены и ширины, без пересечений.
  const walls = buildWalls(plan);
  const byWall = new Map();
  for (const o of openings) {
    const wall = wallOfOpening(o, walls);
    const where = `(${o.x}, ${o.y})`;
    if (!wall) {
      add('OPENING_NOT_ON_WALL', `Проём ${where} не лежит на стене`);
      continue;
    }
    if (!byWall.has(wall.id)) byWall.set(wall.id, []);
    byWall.get(wall.id).push(o);

    if (o.type === 'door') {
      if (o.width < 70 || o.width > 90) add('DOOR_WIDTH', `Дверь ${where}: ширина должна быть 70–90 см`);
      if (wall.kind !== 'inner') add('DOOR_NOT_INNER', `Дверь ${where} стоит не на внутренней стене`);
    } else if (o.type === 'entrance') {
      if (o.width !== ENTRANCE_W) add('ENTRANCE_WIDTH', `Входная дверь ${where}: ширина должна быть 90 см`);
      if (wall.kind !== 'outer') add('ENTRANCE_NOT_OUTER', `Входная дверь ${where} стоит не на внешней стене`);
    } else {
      if (o.width < 60 || o.width > 200) add('WINDOW_WIDTH', `Окно ${where}: ширина должна быть 60–200 см`);
      if (wall.kind !== 'outer') add('WINDOW_NOT_OUTER', `Окно ${where} стоит не на внешней стене`);
    }
  }
  for (const list of byWall.values()) {
    list.sort((p, q) => along(p) - along(q));
    for (let i = 1; i < list.length; i++) {
      if (along(list[i]) < along(list[i - 1]) + list[i - 1].width) {
        add('OPENING_OVERLAP', `Проёмы (${list[i - 1].x}, ${list[i - 1].y}) и (${list[i].x}, ${list[i].y}) пересекаются`);
      }
    }
  }

  const entrances = openings.filter((o) => o.type === 'entrance');
  if (entrances.length !== 1) add('ENTRANCE_COUNT', `Входных дверей: ${entrances.length}, должна быть одна`);

  // Окно в каждой жилой комнате и на кухне.
  const lit = new Set();
  for (const o of openings) {
    const wall = o.type === 'window' && wallOfOpening(o, walls);
    if (wall && wall.kind === 'outer') lit.add(wall.a ?? wall.b);
  }
  for (const r of rooms) {
    if (NEED_WINDOW.includes(r.type) && !lit.has(r.id)) add('NO_WINDOW', `В комнате ${r.id} нет окна`);
  }

  // Достижимость от входной двери.
  if (entrances.length === 1 && entranceRoom(plan, walls) !== null) {
    const seen = reachableRooms(plan, walls);
    const lost = rooms.filter((r) => !seen.has(r.id)).map((r) => r.id);
    if (lost.length) add('UNREACHABLE', `Нельзя попасть в комнаты: ${lost.join(', ')}`);
  }

  return done();
}

/* ---------- Коллизии ---------- */

// Прямоугольники-препятствия: стены без дверных проёмов, в которые проходит игрок.
// Окна и входная дверь — сплошные, поэтому квартиру покинуть нельзя.
export function buildColliders(plan) {
  const walls = buildWalls(plan);
  const rects = wallPosts(plan, walls).map(({ x0, y0, x1, y1 }) => ({ x0, y0, x1, y1 }));
  for (const wall of walls) {
    for (const { from, to, opening } of splitWall(wall, plan.openings)) {
      const passable = opening && opening.type === 'door' && opening.width >= MIN_PASS;
      if (!passable) rects.push(pieceRect(wall, from, to));
    }
  }
  return rects;
}

// Выталкивает круг радиуса r из прямоугольников walls. → исправленная позиция { x, y }.
export function collide(pos, walls, r = PLAYER_R) {
  let { x, y } = pos;
  for (let pass = 0; pass < 4; pass++) {
    let moved = false;
    for (const w of walls) {
      const cx = clamp(x, w.x0, w.x1);
      const cy = clamp(y, w.y0, w.y1);
      const dx = x - cx;
      const dy = y - cy;
      const d2 = dx * dx + dy * dy;
      if (d2 >= r * r) continue;
      if (d2 > 1e-9) {
        const d = Math.sqrt(d2);
        x = cx + (dx / d) * r;
        y = cy + (dy / d) * r;
      } else {
        // Центр внутри стены — выходим через ближайшую грань.
        const exits = [
          [x - w.x0, () => (x = w.x0 - r)],
          [w.x1 - x, () => (x = w.x1 + r)],
          [y - w.y0, () => (y = w.y0 - r)],
          [w.y1 - y, () => (y = w.y1 + r)],
        ];
        exits.sort((p, q) => p[0] - q[0])[0][1]();
      }
      moved = true;
    }
    if (!moved) break;
  }
  return { x, y };
}

// Старт прогулки: у входной двери изнутри, взгляд вглубь квартиры.
// → { x, y, dx, dy } либо null, если входа нет.
export function startPosition(plan) {
  const entrance = plan.openings.find((o) => o.type === 'entrance');
  const wall = entrance && wallOfOpening(entrance, buildWalls(plan));
  if (!wall) return null;
  const sign = wall.b !== null ? 1 : -1; // комната снизу/справа от линии — смотрим в +
  const mid = along(entrance) + entrance.width / 2;
  const off = across(wall) + sign * (wall.t / 2 + PLAYER_R + 10);
  return wall.dir === 'h' ? { x: mid, y: off, dx: 0, dy: sign } : { x: off, y: mid, dx: sign, dy: 0 };
}
