import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mulberry32, generatePlan, randomApartment } from '../public/js/generator.js';
import {
  validatePlan,
  reachableRooms,
  wallBoxes,
  buildColliders,
  startPosition,
  collide,
  countLivingRooms,
} from '../public/js/model.js';

test('mulberry32 воспроизводим и даёт числа в [0, 1)', () => {
  const a = mulberry32(42);
  const b = mulberry32(42);
  for (let i = 0; i < 100; i++) {
    const v = a();
    assert.equal(v, b());
    assert.ok(v >= 0 && v < 1);
  }
  assert.notEqual(mulberry32(1)(), mulberry32(2)());
});

test('generatePlan детерминирован', () => {
  assert.deepEqual(generatePlan(7, 2), generatePlan(7, 2));
});

test('randomApartment: 50 seed-ов — планы валидны, все комнаты достижимы, 3D-объёмы строятся', () => {
  const seen = new Set();
  for (let seed = 1; seed <= 50; seed++) {
    const apt = randomApartment(seed);
    assert.ok(apt, `seed ${seed}: квартира не сгенерирована`);
    assert.deepEqual(apt, randomApartment(seed), `seed ${seed}: результат не воспроизводим`);
    const { plan } = apt;
    assert.deepEqual(validatePlan(plan), { ok: true, errors: [] }, `seed ${seed}`);
    assert.equal(reachableRooms(plan).size, plan.rooms.length, `seed ${seed}: недостижимая комната`);
    assert.equal(apt.rooms, countLivingRooms(plan));
    assert.ok(wallBoxes(plan).length > 0);
    const start = startPosition(plan);
    assert.deepEqual(collide(start, buildColliders(plan)), { x: start.x, y: start.y }, `seed ${seed}: старт в стене`);
    seen.add(JSON.stringify(plan));
  }
  assert.ok(seen.size > 40, 'планы должны различаться');
});

test('randomApartment учитывает комнатность', () => {
  for (const rooms of [1, 2, 3]) {
    const apt = randomApartment(100 + rooms, { rooms });
    assert.equal(apt.rooms, rooms);
    assert.equal(apt.plan.rooms.length, rooms + 3);
  }
});
