import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStore, createNeonStore, createFileStore, SCHEMA } from '../lib/store.js';
import { createApp } from '../server.js';
import { randomApartment } from '../public/js/generator.js';

// Заглушка драйвера Neon: запоминает запросы и отвечает заранее заданными строками.
function fakeSql(answers) {
  const calls = [];
  const sql = async (strings, ...values) => {
    assert.ok(Array.isArray(strings.raw), 'запрос должен идти как tagged template');
    calls.push({ text: strings.join('?').replace(/\s+/g, ' ').trim(), values });
    return answers.shift() ?? [];
  };
  return { sql, calls };
}

const { plan } = randomApartment(3);
const row = { id: 'A-1-01', floor: 1, number: 1, rooms: 2, price_per_m2: 9500000, status: 'free', plan };

test('createStore: база при наличии адреса, иначе файлы', () => {
  assert.equal(createStore({ dataDir: 'data', url: '' }).kind, 'file');
  assert.equal(createStore({ dataDir: 'data', url: 'postgresql://x' }).kind, 'neon');
  assert.equal(createFileStore('data').kind, 'file');
});

test('схема: таблицы квартир и заявок', () => {
  assert.equal(SCHEMA.length, 2);
  assert.match(SCHEMA[0], /CREATE TABLE IF NOT EXISTS apartments/);
  assert.match(SCHEMA[1], /CREATE TABLE IF NOT EXISTS leads/);
});

test('Neon: квартиры приводятся к формату приложения', async () => {
  const { sql, calls } = fakeSql([[row], [row], []]);
  const store = createNeonStore('postgresql://x', sql);
  const expected = { id: 'A-1-01', floor: 1, number: 1, rooms: 2, pricePerM2: 9500000, status: 'free', plan };
  assert.deepEqual(await store.listApartments(), [expected]);
  assert.deepEqual(await store.getApartment('A-1-01'), expected);
  assert.equal(await store.getApartment('NOPE'), null);
  // Значения уходят параметрами, а не подставляются в текст запроса.
  assert.deepEqual(calls[1].values, ['A-1-01']);
  assert.ok(!calls[2].text.includes('NOPE'));
});

test('Neon: заявка сохраняется, при совпадении id берётся следующий', async () => {
  const createdAt = new Date('2026-10-09T15:00:00.000Z');
  const { sql, calls } = fakeSql([[], [{ created_at: createdAt }]]);
  const store = createNeonStore('postgresql://x', sql);
  const lead = await store.addLead({ apartmentId: 'A-1-01', name: 'Азиз', phone: '+998901234567' });
  assert.equal(calls.length, 2);
  const [firstId] = calls[0].values;
  const [secondId, apartmentId, name, phone] = calls[1].values;
  assert.equal(Number(secondId.slice(2)), Number(firstId.slice(2)) + 1);
  assert.deepEqual([apartmentId, name, phone], ['A-1-01', 'Азиз', '+998901234567']);
  assert.deepEqual(lead, { id: secondId, apartmentId: 'A-1-01', name: 'Азиз', phone: '+998901234567', createdAt: '2026-10-09T15:00:00.000Z' });
});

test('API поверх базы: те же ответы, что и с файлами', async () => {
  const sold = { ...row, id: 'A-1-02', status: 'sold' };
  const { sql } = fakeSql([[row, sold], [row], [sold], [row], [{ created_at: new Date() }]]);
  const server = createApp({ store: createNeonStore('postgresql://x', sql) }).listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const post = (body) => fetch(`${base}/api/leads`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  try {
    const list = await (await fetch(`${base}/api/apartments`)).json();
    assert.deepEqual(list.map((a) => [a.id, a.status, typeof a.area, typeof a.price, 'plan' in a]), [
      ['A-1-01', 'free', 'number', 'number', false],
      ['A-1-02', 'sold', 'number', 'number', false],
    ]);
    assert.deepEqual((await (await fetch(`${base}/api/apartments/A-1-01`)).json()).plan, plan);
    const refused = await post({ apartmentId: 'A-1-02', name: 'Азиз', phone: '+998901234567' });
    assert.equal(refused.status, 400);
    assert.equal((await refused.json()).code, 'sold');
    const ok = await post({ apartmentId: 'A-1-01', name: 'Азиз', phone: '+998901234567' });
    assert.equal(ok.status, 201);
    assert.match((await ok.json()).id, /^L-\d+$/);
  } finally {
    server.close();
  }
});
