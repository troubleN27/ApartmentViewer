import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as m from '../public/js/model.js';

// Пример из CLAUDE.md, дополненный дверями и окнами до валидного плана.
const basePlan = () => ({
  width: 900,
  length: 700,
  height: 280,
  rooms: [
    { id: 'r1', type: 'living', x: 0, y: 0, w: 500, l: 400 },
    { id: 'r2', type: 'bedroom', x: 500, y: 0, w: 400, l: 400 },
    { id: 'r3', type: 'hall', x: 0, y: 400, w: 400, l: 300 },
    { id: 'r4', type: 'kitchen', x: 400, y: 400, w: 300, l: 300 },
    { id: 'r5', type: 'bathroom', x: 700, y: 400, w: 200, l: 300 },
  ],
  openings: [
    { type: 'entrance', x: 100, y: 700, width: 90, dir: 'h' },
    { type: 'door', x: 150, y: 400, width: 80, dir: 'h' },
    { type: 'door', x: 500, y: 150, width: 80, dir: 'v' },
    { type: 'door', x: 400, y: 500, width: 80, dir: 'v' },
    { type: 'door', x: 700, y: 520, width: 70, dir: 'v' },
    { type: 'window', x: 150, y: 0, width: 150, dir: 'h' },
    { type: 'window', x: 600, y: 0, width: 150, dir: 'h' },
    { type: 'window', x: 480, y: 700, width: 120, dir: 'h' },
  ],
});

const codes = (plan) => m.validatePlan(plan).errors.map((e) => e.code);

test('roomArea и planArea считают площадь в м²', () => {
  const plan = basePlan();
  assert.equal(m.roomArea(plan.rooms[0]), 20);
  assert.equal(m.planArea(plan), 63);
});

test('calcPrice округляет до целого сума', () => {
  assert.equal(m.calcPrice(63, 9500000), 598500000);
  assert.equal(m.calcPrice(41.25, 9333333), 384999986);
});

test('formatArea и formatPrice', () => {
  assert.equal(m.formatArea(63), '63,0');
  assert.equal(m.formatArea(41.26), '41,3');
  assert.equal(m.formatPrice(1250000000), '1 250 000 000');
  assert.equal(m.formatPrice(950), '950');
});

test('countLivingRooms считает гостиные и спальни', () => {
  assert.equal(m.countLivingRooms(basePlan()), 2);
});

test('roomAt находит комнату по точке', () => {
  const plan = basePlan();
  assert.equal(m.roomAt(plan, 10, 10).id, 'r1');
  assert.equal(m.roomAt(plan, 800, 600).id, 'r5');
  assert.equal(m.roomAt(plan, 950, 10), null);
});

test('buildWalls: внешние 25 см, внутренние 10 см, сегмент на пару комнат', () => {
  const walls = m.buildWalls(basePlan());
  const outer = walls.filter((w) => w.kind === 'outer');
  const inner = walls.filter((w) => w.kind === 'inner');
  assert.equal(outer.length, 9);
  assert.equal(inner.length, 7);
  assert.ok(outer.every((w) => w.t === 25 && (w.a === null) !== (w.b === null)));
  assert.ok(inner.every((w) => w.t === 10 && w.a && w.b));
  // Периметр внешних стен равен периметру квартиры.
  assert.equal(outer.reduce((s, w) => s + w.len, 0), 2 * (900 + 700));
  // Линия y=400 разбита в точках примыкания.
  const mid = walls.filter((w) => w.dir === 'h' && w.y === 400).map((w) => [w.x, w.len, w.a, w.b]);
  assert.deepEqual(mid, [
    [0, 400, 'r1', 'r3'],
    [400, 100, 'r1', 'r4'],
    [500, 200, 'r2', 'r4'],
    [700, 200, 'r2', 'r5'],
  ]);
});

test('wallOfOpening: проём на стене и вне её', () => {
  const walls = m.buildWalls(basePlan());
  const w = m.wallOfOpening({ type: 'door', x: 150, y: 400, width: 80, dir: 'h' }, walls);
  assert.deepEqual([w.a, w.b], ['r1', 'r3']);
  // Выходит за конец сегмента (0–400).
  assert.equal(m.wallOfOpening({ type: 'door', x: 350, y: 400, width: 80, dir: 'h' }, walls), null);
  assert.equal(m.wallOfOpening({ type: 'door', x: 150, y: 300, width: 80, dir: 'h' }, walls), null);
});

test('wallRect — глухая часть стены между столбиками', () => {
  const walls = m.buildWalls(basePlan());
  const top = walls.find((w) => w.dir === 'h' && w.y === 0 && w.x === 0);
  assert.deepEqual(m.wallRect(top), { x0: 12.5, y0: -12.5, x1: 495, y1: 12.5 });
});

test('wallPosts: столбики в узлах, грани знают свою комнату', () => {
  const plan = basePlan();
  const posts = m.wallPosts(plan);
  assert.equal(posts.length, 12);
  const corner = posts.find((p) => p.x0 === -12.5 && p.y0 === -12.5);
  assert.deepEqual([corner.x1, corner.y1, corner.faces.xn, corner.faces.yn], [12.5, 12.5, null, null]);
  // Т-образный узел на верхней стене: внутренняя стена 10 см упирается во внешнюю 25 см.
  const tee = posts.find((p) => p.x0 === 495 && p.y0 === -12.5);
  assert.deepEqual([tee.x1, tee.y1, tee.faces.yn], [505, 12.5, null]);
  // Узел (400, 400): справа и снизу стены, сверху и слева — гостиная r1 и прихожая r3.
  const inner = posts.find((p) => p.x0 === 395 && p.y0 === 395);
  assert.equal(inner.faces.yn, 'r1');
});

test('wallPosts: грани, закрытые стеной, не помечены', () => {
  const posts = m.wallPosts(basePlan());
  // Угол (0, 0): стены уходят вправо и вниз.
  const corner = posts.find((p) => p.x0 === -12.5 && p.y0 === -12.5);
  assert.deepEqual(corner.faces, { xn: null, xp: undefined, yn: null, yp: undefined });
  // Узел (400, 400): открыта только верхняя грань — в гостиную.
  const inner = posts.find((p) => p.x0 === 395 && p.y0 === 395);
  assert.deepEqual(inner.faces, { xn: undefined, xp: undefined, yn: 'r1', yp: undefined });
});

test('trimBoxes: плинтусы, наличники, рамы и подоконники', () => {
  const plan = basePlan();
  const trim = m.trimBoxes(plan);
  const of = (kind) => trim.filter((b) => b.kind === kind);
  assert.ok(trim.every((b) => b.x1 > b.x0 && b.y1 > b.y0 && b.z1 > b.z0));
  // Наличники: 4 двери с двух сторон и вход с одной, по три планки.
  assert.equal(of('casing').length, (4 * 2 + 1) * 3);
  assert.ok(of('casing').every((b) => b.z1 === 217));
  // Окна: 4 профиля рамы и импост, подоконник только внутри.
  assert.equal(of('frame').length, 3 * 5);
  assert.equal(of('sill').length, 3);
  assert.ok(of('sill').every((b) => b.z1 === 80 && b.y0 >= 0 && b.y1 <= plan.length));
  // Плинтус высотой 8 см, внутри контура квартиры и не перекрывает дверные проёмы.
  const base = of('baseboard');
  assert.ok(base.length > 20);
  assert.ok(base.every((b) => b.z0 === 0 && b.z1 === 8 && b.x0 >= 0 && b.y0 >= 0 && b.x1 <= plan.width && b.y1 <= plan.length));
  for (const o of plan.openings.filter((d) => d.type !== 'window')) {
    const [x0, x1, y0, y1] = o.dir === 'h' ? [o.x, o.x + o.width, o.y - 20, o.y + 20] : [o.x - 20, o.x + 20, o.y, o.y + o.width];
    assert.ok(!base.some((b) => b.x0 < x1 && x0 < b.x1 && b.y0 < y1 && y0 < b.y1), JSON.stringify(o));
  }
  // Плинтус гостиной вдоль верхней стены: от угла до угла комнаты, кроме… окна он не боится.
  const top = base.filter((b) => b.y0 === 12.5 && b.y1 === 14 && b.x1 <= 500);
  assert.equal(top.reduce((s, b) => s + b.x1 - b.x0, 0), 495 - 12.5);
});

test('объёмы стен не перекрываются', () => {
  const plan = basePlan();
  const rects = m.wallBoxes(plan).filter((b) => b.kind === 'wall' && b.z0 === 0 || b.z1 === plan.height);
  for (let i = 0; i < rects.length; i++) {
    for (let j = i + 1; j < rects.length; j++) {
      const p = rects[i];
      const q = rects[j];
      const overlap = p.x0 < q.x1 && q.x0 < p.x1 && p.y0 < q.y1 && q.y0 < p.y1 && p.z0 < q.z1 && q.z0 < p.z1;
      assert.equal(overlap, false, JSON.stringify([p, q]));
    }
  }
});

test('splitWall делит стену на глухие участки и проёмы', () => {
  const plan = basePlan();
  const top = m.buildWalls(plan).find((w) => w.dir === 'h' && w.y === 0 && w.x === 0);
  const pieces = m.splitWall(top, plan.openings);
  assert.deepEqual(
    pieces.map((p) => [p.from, p.to, p.opening?.type ?? null]),
    [
      [12.5, 150, null],
      [150, 300, 'window'],
      [300, 495, null],
    ],
  );
});

test('wallBoxes: перемычки, подоконная часть, стекло, полотно входа', () => {
  const plan = basePlan();
  const boxes = m.wallBoxes(plan);
  const at = (x0, x1, y) => boxes.filter((b) => b.x0 === x0 && b.x1 === x1 && b.y0 < y && b.y1 > y);
  // Окно гостиной: подоконная часть, перемычка и стекло.
  const win = at(150, 300, 0);
  assert.deepEqual(win.map((b) => [b.z0, b.z1, b.kind]), [
    [0, 80, 'wall'],
    [230, 280, 'wall'],
    [80, 230, 'glass'],
  ]);
  // Дверь: только перемычка.
  assert.deepEqual(at(150, 230, 400).map((b) => [b.z0, b.z1, b.kind]), [[210, 280, 'wall']]);
  // Вход: перемычка и полотно.
  assert.deepEqual(at(100, 190, 700).map((b) => b.kind), ['wall', 'entrance']);
  assert.ok(boxes.every((b) => b.x1 > b.x0 && b.y1 > b.y0 && b.z1 > b.z0));
  // Каждый объём знает стороны своей стены — по ним 3D выбирает отделку.
  assert.deepEqual([win[0].faces, win[0].wallKind], [{ yn: null, yp: 'r1' }, 'outer']);
  const inner = at(150, 230, 400)[0];
  assert.deepEqual([inner.faces, inner.wallKind], [{ yn: 'r1', yp: 'r3' }, 'inner']);
  assert.equal(boxes.filter((b) => b.wallKind === 'post').length, 12);
});

test('roomGraph, entranceRoom и reachableRooms', () => {
  const plan = basePlan();
  const graph = m.roomGraph(plan);
  assert.deepEqual([...graph.get('r3')].sort(), ['r1', 'r4']);
  assert.equal(m.entranceRoom(plan), 'r3');
  assert.equal(m.reachableRooms(plan).size, 5);
  plan.openings = plan.openings.filter((o) => !(o.type === 'door' && o.x === 700));
  assert.deepEqual([...m.reachableRooms(plan)].sort(), ['r1', 'r2', 'r3', 'r4']);
});

test('validatePlan: эталонный план валиден', () => {
  assert.deepEqual(m.validatePlan(basePlan()), { ok: true, errors: [] });
});

test('validatePlan: формат', () => {
  assert.deepEqual(codes(null), ['BAD_FORMAT']);
  const plan = basePlan();
  plan.rooms[0].w = 500.5;
  assert.deepEqual(codes(plan), ['BAD_FORMAT']);
});

test('validatePlan: комнаты вне контура, пересечение, неполное покрытие', () => {
  let plan = basePlan();
  plan.rooms[1].w = 450;
  assert.ok(codes(plan).includes('OUT_OF_BOUNDS'));

  plan = basePlan();
  plan.rooms[3].x = 350;
  assert.ok(codes(plan).includes('OVERLAP'));

  plan = basePlan();
  plan.rooms[4].l = 250;
  assert.deepEqual(codes(plan), ['NOT_COVERED']);
});

test('validatePlan: проём не на стене и пересечение проёмов', () => {
  let plan = basePlan();
  plan.openings.push({ type: 'door', x: 200, y: 200, width: 80, dir: 'h' });
  assert.deepEqual(codes(plan), ['OPENING_NOT_ON_WALL']);

  plan = basePlan();
  plan.openings.push({ type: 'window', x: 250, y: 0, width: 100, dir: 'h' });
  assert.deepEqual(codes(plan), ['OPENING_OVERLAP']);
});

test('validatePlan: правила дверей', () => {
  let plan = basePlan();
  plan.openings[1].width = 95;
  assert.deepEqual(codes(plan), ['DOOR_WIDTH']);

  plan = basePlan();
  plan.openings.push({ type: 'door', x: 0, y: 100, width: 80, dir: 'v' });
  assert.deepEqual(codes(plan), ['DOOR_NOT_INNER']);
});

test('validatePlan: правила входной двери', () => {
  let plan = basePlan();
  plan.openings.shift();
  assert.deepEqual(codes(plan), ['ENTRANCE_COUNT']);

  plan = basePlan();
  plan.openings.push({ type: 'entrance', x: 0, y: 500, width: 90, dir: 'v' });
  assert.deepEqual(codes(plan), ['ENTRANCE_COUNT']);

  plan = basePlan();
  plan.openings[0].width = 80;
  assert.deepEqual(codes(plan), ['ENTRANCE_WIDTH']);

  plan = basePlan();
  plan.openings[0] = { type: 'entrance', x: 400, y: 420, width: 90, dir: 'v' };
  assert.ok(codes(plan).includes('ENTRANCE_NOT_OUTER'));
});

test('validatePlan: правила окон', () => {
  let plan = basePlan();
  plan.openings[5].width = 50;
  assert.deepEqual(codes(plan), ['WINDOW_WIDTH']);

  plan = basePlan();
  plan.openings.push({ type: 'window', x: 400, y: 410, width: 60, dir: 'v' });
  assert.deepEqual(codes(plan), ['WINDOW_NOT_OUTER']);

  plan = basePlan();
  plan.openings = plan.openings.filter((o) => !(o.type === 'window' && o.y === 700));
  assert.deepEqual(codes(plan), ['NO_WINDOW']);
});

test('validatePlan: недостижимая комната', () => {
  const plan = basePlan();
  plan.openings = plan.openings.filter((o) => !(o.type === 'door' && o.x === 700));
  assert.deepEqual(codes(plan), ['UNREACHABLE']);
});

test('buildColliders: в дверях проход, окна и вход закрыты', () => {
  const plan = basePlan();
  const rects = m.buildColliders(plan);
  const hit = (x, y) => rects.some((r) => x > r.x0 && x < r.x1 && y > r.y0 && y < r.y1);
  assert.equal(hit(190, 400), false); // дверь гостиная ↔ прихожая
  assert.equal(hit(300, 400), true); // глухой участок той же стены
  assert.equal(hit(145, 700), true); // входная дверь
  assert.equal(hit(200, 0), true); // окно
});

test('collide: стена останавливает, вдоль стены скользим', () => {
  const walls = m.buildColliders(basePlan());
  // Идём в левую внешнюю стену (её грань x = 12.5).
  const a = m.collide({ x: 20, y: 200 }, walls);
  assert.equal(a.x, 37.5);
  assert.equal(a.y, 200);
  // Вдали от стен позиция не меняется.
  assert.deepEqual(m.collide({ x: 250, y: 200 }, walls), { x: 250, y: 200 });
  // Центр оказался внутри стены — выталкивает наружу.
  const b = m.collide({ x: 300, y: 399 }, walls);
  assert.ok(b.y <= 395 - 25 + 1e-6);
});

test('collide: в дверной проём игрок проходит, сквозь стену — нет', () => {
  const plan = basePlan();
  const walls = m.buildColliders(plan);
  const walk = (x, fromY, toY) => {
    let pos = { x, y: fromY };
    for (let i = 0; i < 400 && pos.y < toY; i++) pos = m.collide({ x: pos.x, y: pos.y + 4 }, walls);
    return pos;
  };
  // Дверь x 150–230 в стене y=400: проходим из гостиной в прихожую.
  assert.ok(walk(190, 300, 500).y >= 500);
  // Мимо двери — упираемся в стену.
  assert.ok(walk(320, 300, 500).y < 400 - 25);
});

test('collide: из квартиры выйти нельзя', () => {
  const plan = basePlan();
  const walls = m.buildColliders(plan);
  let pos = { x: 145, y: 600 }; // напротив входной двери
  for (let i = 0; i < 200; i++) pos = m.collide({ x: pos.x, y: pos.y + 4 }, walls);
  assert.ok(pos.y <= 700 - 12.5 - 25 + 1e-6);
});

test('startPosition: у входа изнутри, взгляд вглубь', () => {
  const plan = basePlan();
  assert.deepEqual(m.startPosition(plan), { x: 145, y: 652.5, dx: 0, dy: -1 });
  const start = m.startPosition(plan);
  assert.equal(m.roomAt(plan, start.x, start.y).id, 'r3');
  assert.deepEqual(m.collide(start, m.buildColliders(plan)), { x: start.x, y: start.y });
  plan.openings.shift();
  assert.equal(m.startPosition(plan), null);
});
