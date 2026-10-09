// Готовит базу Neon: создаёт таблицы и загружает квартиры из data/apartments.json.
// Запуск: DATABASE_URL в .env или в окружении, затем `npm run db:seed`.
// Повторный запуск обновляет квартиры и не трогает заявки.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { neon } from '@neondatabase/serverless';
import { SCHEMA, databaseUrl } from '../lib/store.js';
import { validatePlan } from '../public/js/model.js';

const url = databaseUrl();
if (!url) {
  console.error('Не задан DATABASE_URL. Скопируйте .env.example в .env и вставьте строку подключения Neon.');
  process.exit(1);
}

const file = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'data', 'apartments.json');
const apartments = JSON.parse(fs.readFileSync(file, 'utf8'));
const broken = apartments.filter((a) => !validatePlan(a.plan).ok);
if (broken.length) {
  console.error(`Невалидные планы: ${broken.map((a) => a.id).join(', ')}`);
  process.exit(1);
}

const sql = neon(url);
for (const statement of SCHEMA) await sql.query(statement);

for (const a of apartments) {
  await sql`
    INSERT INTO apartments (id, floor, number, rooms, price_per_m2, status, plan)
    VALUES (${a.id}, ${a.floor}, ${a.number}, ${a.rooms}, ${a.pricePerM2}, ${a.status}, ${JSON.stringify(a.plan)}::jsonb)
    ON CONFLICT (id) DO UPDATE SET
      floor = EXCLUDED.floor,
      number = EXCLUDED.number,
      rooms = EXCLUDED.rooms,
      price_per_m2 = EXCLUDED.price_per_m2,
      status = EXCLUDED.status,
      plan = EXCLUDED.plan`;
}

const [{ apartments: total, leads }] = await sql`
  SELECT (SELECT count(*) FROM apartments)::int AS apartments, (SELECT count(*) FROM leads)::int AS leads`;
console.log(`База готова: квартир — ${total}, заявок — ${leads}`);
