import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createApp } from '../server.js';
import { randomApartment } from '../public/js/generator.js';
import { planArea, calcPrice } from '../public/js/model.js';

let server;
let base;
let dataDir;

const free = { ...randomApartment(1), id: 'A-1-01', status: 'free' };
const sold = { ...randomApartment(2), id: 'A-1-02', status: 'sold' };

before(async () => {
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nd-test-'));
  fs.writeFileSync(path.join(dataDir, 'apartments.json'), JSON.stringify([free, sold]));
  server = createApp({ dataDir }).listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(() => {
  server.close();
  fs.rmSync(dataDir, { recursive: true, force: true });
});

const post = (body) =>
  fetch(`${base}/api/leads`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

test('GET /api/apartments — список без планов, с площадью и ценой', async () => {
  const res = await fetch(`${base}/api/apartments`);
  assert.equal(res.status, 200);
  const list = await res.json();
  assert.equal(list.length, 2);
  const area = planArea(free.plan);
  assert.deepEqual(list[0], {
    id: 'A-1-01',
    floor: free.floor,
    number: free.number,
    rooms: free.rooms,
    area,
    price: calcPrice(area, free.pricePerM2),
    status: 'free',
  });
});

test('GET /api/apartments/:id — квартира целиком или 404', async () => {
  const ok = await fetch(`${base}/api/apartments/A-1-01`);
  assert.equal(ok.status, 200);
  assert.deepEqual((await ok.json()).plan, free.plan);
  assert.equal((await fetch(`${base}/api/apartments/NOPE`)).status, 404);
});

test('POST /api/leads — проверка полей', async () => {
  const valid = { apartmentId: 'A-1-01', name: 'Азиз', phone: '+998901234567' };
  const cases = [
    [{ ...valid, name: 'А' }, 'name'],
    [{ ...valid, name: 'я'.repeat(61) }, 'name'],
    [{ ...valid, phone: '998901234567' }, 'phone'],
    [{ ...valid, phone: '+99890123456' }, 'phone'],
    [{ ...valid, apartmentId: 'NOPE' }, 'apartment'],
    [{ ...valid, apartmentId: 'A-1-02' }, 'sold'],
  ];
  for (const [body, code] of cases) {
    const res = await post(body);
    assert.equal(res.status, 400);
    const json = await res.json();
    assert.equal(json.code, code);
    assert.ok(json.error);
  }
  assert.equal(fs.existsSync(path.join(dataDir, 'leads.json')), false);
});

test('POST /api/leads — 201 и запись в leads.json', async () => {
  const results = await Promise.all(
    ['Азиз', 'Мадина', 'Тимур'].map((name) => post({ apartmentId: 'A-1-01', name: ` ${name} `, phone: '+998901234567' })),
  );
  for (const res of results) assert.equal(res.status, 201);
  const lead = await results[0].json();
  assert.match(lead.id, /^L-\d+$/);
  assert.equal(lead.apartmentId, 'A-1-01');
  assert.equal(lead.name, 'Азиз');
  assert.ok(!Number.isNaN(Date.parse(lead.createdAt)));

  const saved = JSON.parse(fs.readFileSync(path.join(dataDir, 'leads.json'), 'utf8'));
  assert.equal(saved.length, 3);
  assert.deepEqual(saved.map((l) => l.name).sort(), ['Азиз', 'Мадина', 'Тимур']);
  assert.deepEqual(fs.readdirSync(dataDir).filter((f) => f.endsWith('.tmp')), []);
});
