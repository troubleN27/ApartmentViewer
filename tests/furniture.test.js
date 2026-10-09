import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as f from '../public/js/furniture.js';
import { randomApartment } from '../public/js/generator.js';
import { buildColliders, collide, startPosition, roomAt } from '../public/js/model.js';

const plan = {
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
};
const item = (type, x, y, rot = 0, id = type) => ({ id, type, x, y, rot });
const overlap = (p, q) => p.x0 < q.x1 - 1e-6 && q.x0 < p.x1 - 1e-6 && p.y0 < q.y1 - 1e-6 && q.y0 < p.y1 - 1e-6;

test('каталог: у каждого предмета есть размеры, группа, детали и известные материалы', () => {
  const types = Object.keys(f.CATALOG);
  assert.ok(types.length >= 25);
  for (const type of types) {
    const def = f.CATALOG[type];
    assert.ok(def.w > 0 && def.d > 0 && def.h > 0, type);
    assert.ok(f.GROUPS.includes(def.group), type);
    assert.ok(def.parts.length > 0 && def.top.length > 0, type);
    for (const p of def.parts) {
      assert.ok(f.MATERIALS[p.mat], `${type}: материал ${p.mat}`);
      // Детали не выходят за габариты предмета (ручки могут выступать на пару сантиметров).
      const [x0, x1, y0, y1] = p.shape === 'box' ? [p.x, p.x + p.sx, p.y, p.y + p.sy] : [p.x - p.r, p.x + p.r, p.y - p.r, p.y + p.r];
      assert.ok(x0 >= -0.01 && x1 <= def.w + 0.01 && y0 >= -0.01 && y1 <= def.d + 4, `${type}: деталь вне габаритов ${JSON.stringify(p)}`);
      const top = p.shape === 'box' ? p.z + p.sz : p.shape === 'cyl' ? p.z + p.h : p.z + p.r;
      assert.ok(top <= def.h + 0.01, `${type}: деталь выше предмета ${JSON.stringify(p)}`);
    }
  }
});

test('footprint и frontZone учитывают поворот', () => {
  assert.deepEqual(f.footprint(item('sofa', 200, 100, 0)), { x0: 90, y0: 52.5, x1: 310, y1: 147.5 });
  assert.deepEqual(f.footprint(item('sofa', 200, 200, 90)), { x0: 152.5, y0: 90, x1: 247.5, y1: 310 });
  // rot 0 — лицом вниз (+Y), rot 90 — спинкой к правой стене, лицом влево.
  assert.deepEqual(f.frontZone(item('sofa', 200, 100, 0)), { x0: 90, y0: 147.5, x1: 310, y1: 187.5 });
  assert.deepEqual(f.frontZone(item('sofa', 200, 200, 90)), { x0: 112.5, y0: 90, x1: 152.5, y1: 310 });
  assert.equal(f.frontZone(item('rug', 200, 200)), null);
});

test('roomInterior — между гранями стен', () => {
  assert.deepEqual(f.roomInterior(plan, plan.rooms[0]), { x0: 12.5, y0: 12.5, x1: 495, y1: 395 });
  assert.deepEqual(f.roomInterior(plan, plan.rooms[3]), { x0: 405, y0: 405, x1: 695, y1: 687.5 });
});

test('doorZones: зона с каждой стороны двери, у входа — только внутри', () => {
  const zones = f.doorZones(plan);
  assert.equal(zones.length, 4 * 2 + 1);
  const entrance = zones.find((z) => z.roomId === 'r3' && z.rect.y1 === 700);
  assert.deepEqual(entrance.rect, { x0: 95, y0: 615, x1: 195, y1: 700 });
});

test('canPlace: границы комнаты, пересечение, дверь', () => {
  const sofa = item('sofa', 250, 60);
  assert.deepEqual(f.canPlace(plan, [], sofa), { ok: true, reason: null });
  assert.equal(f.canPlace(plan, [], item('sofa', 100, 60)).reason, 'bounds'); // в стене
  assert.equal(f.canPlace(plan, [], item('sofa', 480, 200, 90)).reason, 'bounds'); // через стену в спальню
  assert.equal(f.canPlace(plan, [], item('sofa', 2000, 60)).reason, 'bounds');
  assert.equal(f.canPlace(plan, [sofa], item('armchair', 300, 80, 0, 'a')).reason, 'overlap');
  assert.equal(f.canPlace(plan, [], item('armchair', 190, 345, 180)).reason, 'door'); // перед дверью в прихожую
  assert.equal(f.canPlace(plan, [], item('nope', 250, 60)).reason, 'type');
  assert.equal(f.canPlace(plan, [], { ...sofa, rot: 45 }).reason, 'type');
  // Сам с собой предмет не пересекается (перетаскивание).
  assert.equal(f.canPlace(plan, [sofa], { ...sofa, x: 255 }).ok, true);
});

test('canPlace: ковёр можно класть под мебель и перед дверью', () => {
  const sofa = item('sofa', 250, 60);
  assert.equal(f.canPlace(plan, [sofa], item('rug', 250, 120)).ok, true);
  assert.equal(f.canPlace(plan, [], item('rug', 190, 320)).ok, true);
  assert.equal(f.canPlace(plan, [item('rug', 250, 120)], sofa).ok, true);
});

test('canPlace: нельзя перекрыть проход между дверями', () => {
  // Гостиная: двери вниз (в прихожую) и вправо (в спальню). Стена из шкафов отрезает одну от другой.
  const wall = [item('wardrobe', 102.5, 262, 0, 'w1'), item('wardrobe', 282.5, 262, 0, 'w2')];
  assert.equal(f.canPlace(plan, wall, item('bookshelf', 417.5, 262, 0, 'w3')).reason, 'passage');
  assert.equal(f.canPlace(plan, wall, item('plant', 400, 60, 0, 'p')).ok, true);
});

test('sanitizeFurniture отбрасывает то, что поставить нельзя', () => {
  const kept = f.sanitizeFurniture(plan, [
    item('sofa', 250, 60, 0, 'a'),
    item('armchair', 300, 80, 0, 'b'), // пересекается с диваном
    item('sofa', 250, 60, 0, 'a'), // повтор id
    item('nope', 250, 300, 0, 'c'),
    null,
    item('bedDouble', 700, 120, 0, 'd'),
  ]);
  assert.deepEqual(kept.map((k) => k.id), ['a', 'd']);
  assert.deepEqual(f.sanitizeFurniture(plan, 'мусор'), []);
});

test('furnitureColliders: все предметы, кроме ковров', () => {
  const rects = f.furnitureColliders([item('sofa', 250, 60), item('rug', 250, 150)]);
  assert.deepEqual(rects, [{ x0: 140, y0: 12.5, x1: 360, y1: 107.5 }]);
});

test('autoFurnish воспроизводим и зависит от seed', () => {
  assert.deepEqual(f.autoFurnish(plan, 5), f.autoFurnish(plan, 5));
  assert.notDeepEqual(f.autoFurnish(plan, 5), f.autoFurnish(plan, 6));
});

test('autoFurnish: 40 квартир — всё стоит по правилам, по квартире можно пройти', () => {
  const stats = { items: 0, bed: 0, bedrooms: 0, toilet: 0, sofa: 0, fridge: 0 };
  for (let seed = 1; seed <= 40; seed++) {
    const { plan: p } = randomApartment(seed);
    const items = f.autoFurnish(p, seed * 7);
    assert.ok(items.length >= 8, `seed ${seed}: всего ${items.length} предметов`);
    assert.equal(new Set(items.map((i) => i.id)).size, items.length);
    // Каждый предмет проходит те же правила, что и при ручной расстановке.
    assert.equal(f.sanitizeFurniture(p, items).length, items.length, `seed ${seed}`);
    for (const i of items) assert.equal(f.canPlace(p, items, i).ok, true, `seed ${seed}: ${i.type}`);
    const solid = f.furnitureColliders(items);
    for (let a = 0; a < solid.length; a++) {
      for (let c = a + 1; c < solid.length; c++) assert.equal(overlap(solid[a], solid[c]), false, `seed ${seed}`);
    }

    // Игрок радиусом 25 см доходит от входа до каждой комнаты.
    const colliders = [...buildColliders(p), ...solid];
    const free = (x, y) => {
      const r = collide({ x, y }, colliders);
      return Math.abs(r.x - x) < 1e-6 && Math.abs(r.y - y) < 1e-6;
    };
    const start = startPosition(p);
    assert.ok(free(start.x, start.y), `seed ${seed}: старт занят мебелью`);
    const step = 10;
    const seen = new Set();
    const reached = new Set();
    const stack = [[Math.round(start.x / step), Math.round(start.y / step)]];
    seen.add(stack[0].join());
    while (stack.length) {
      const [i, j] = stack.pop();
      const room = roomAt(p, i * step, j * step);
      if (room) reached.add(room.id);
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const key = `${i + di},${j + dj}`;
        if (seen.has(key)) continue;
        seen.add(key);
        if (free((i + di) * step, (j + dj) * step)) stack.push([i + di, j + dj]);
      }
    }
    assert.equal(reached.size, p.rooms.length, `seed ${seed}: с мебелью не во все комнаты можно пройти`);

    const has = (type) => items.some((i) => i.type === type);
    const inRoom = (roomType, types) =>
      p.rooms.filter((r) => r.type === roomType && items.some((i) => types.includes(i.type) && roomAt(p, i.x, i.y) === r)).length;
    stats.items += items.length;
    stats.bedrooms += p.rooms.filter((r) => r.type === 'bedroom').length;
    stats.bed += inRoom('bedroom', ['bedDouble', 'bedSingle']);
    stats.toilet += has('toilet') ? 1 : 0;
    stats.sofa += inRoom('living', ['sofa']);
    stats.fridge += has('fridge') ? 1 : 0;
    // Мебель стоит в комнатах своего назначения.
    for (const i of items) {
      const room = roomAt(p, i.x, i.y);
      const group = f.CATALOG[i.type].group;
      const shared = ['plant', 'rug', 'chair', 'floorLamp'].includes(i.type);
      assert.ok(shared || group === room.type, `seed ${seed}: ${i.type} в комнате ${room.type}`);
    }
  }
  // Главные предметы есть почти везде.
  assert.ok(stats.items / 40 >= 18, `в среднем ${stats.items / 40} предметов`);
  assert.equal(stats.bed, stats.bedrooms, 'кровать в каждой спальне');
  assert.ok(stats.toilet >= 38, `унитаз: ${stats.toilet}/40`);
  assert.ok(stats.sofa >= 38, `диван: ${stats.sofa}/40`);
  assert.ok(stats.fridge >= 36, `холодильник: ${stats.fridge}/40`);
});
