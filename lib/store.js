// Хранилище данных сервера: квартиры и заявки.
// Два варианта с одним интерфейсом:
//   • Neon (PostgreSQL) — когда задана переменная DATABASE_URL (так работает на Vercel);
//   • JSON-файлы в data/ — локально, без базы.
// Интерфейс: listApartments(), getApartment(id), addLead({ apartmentId, name, phone }).
import fs from 'node:fs/promises';
import path from 'node:path';

async function readJson(file, fallback) {
  try {
    return JSON.parse(await fs.readFile(file, 'utf8'));
  } catch (err) {
    if (err.code === 'ENOENT' && fallback !== undefined) return fallback;
    throw err;
  }
}

/* ---------- JSON-файлы ---------- */

export function createFileStore(dataDir) {
  const apartmentsFile = path.join(dataDir, 'apartments.json');
  const leadsFile = path.join(dataDir, 'leads.json');
  let writeQueue = Promise.resolve();

  return {
    kind: 'file',
    listApartments: () => readJson(apartmentsFile, []),
    async getApartment(id) {
      return (await readJson(apartmentsFile, [])).find((a) => a.id === id) || null;
    },
    async addLead({ apartmentId, name, phone }) {
      const lead = { id: `L-${Date.now()}`, apartmentId, name, phone, createdAt: new Date().toISOString() };
      // Запись атомарная: временный файл, затем rename. Записи идут по очереди.
      const write = writeQueue.then(async () => {
        const leads = await readJson(leadsFile, []);
        leads.push(lead);
        const tmp = `${leadsFile}.${process.pid}.tmp`;
        await fs.writeFile(tmp, JSON.stringify(leads, null, 2) + '\n');
        await fs.rename(tmp, leadsFile);
      });
      writeQueue = write.catch(() => {});
      await write;
      return lead;
    },
  };
}

/* ---------- Neon (PostgreSQL) ---------- */

// Схема базы. Применяется скриптом scripts/db-seed.js.
export const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS apartments (
     id TEXT PRIMARY KEY,
     floor INTEGER NOT NULL,
     number INTEGER NOT NULL,
     rooms INTEGER NOT NULL,
     price_per_m2 INTEGER NOT NULL,
     status TEXT NOT NULL CHECK (status IN ('free', 'reserved', 'sold')),
     plan JSONB NOT NULL
   )`,
  `CREATE TABLE IF NOT EXISTS leads (
     id TEXT PRIMARY KEY,
     apartment_id TEXT NOT NULL REFERENCES apartments (id),
     name TEXT NOT NULL,
     phone TEXT NOT NULL,
     created_at TIMESTAMPTZ NOT NULL DEFAULT now()
   )`,
];

const toApartment = (row) => ({
  id: row.id,
  floor: row.floor,
  number: row.number,
  rooms: row.rooms,
  pricePerM2: row.price_per_m2,
  status: row.status,
  plan: row.plan,
});

// client — готовая функция запросов (в тестах подставляется заглушка).
export function createNeonStore(databaseUrl, client = null) {
  // Драйвер подключается при первом запросе — локально без базы он не нужен.
  async function sql(strings, ...values) {
    client ||= (await import('@neondatabase/serverless')).neon(databaseUrl);
    return client(strings, ...values);
  }

  return {
    kind: 'neon',
    async listApartments() {
      const rows = await sql`SELECT id, floor, number, rooms, price_per_m2, status, plan FROM apartments ORDER BY floor, number`;
      return rows.map(toApartment);
    },
    async getApartment(id) {
      const rows = await sql`SELECT id, floor, number, rooms, price_per_m2, status, plan FROM apartments WHERE id = ${id}`;
      return rows.length ? toApartment(rows[0]) : null;
    },
    async addLead({ apartmentId, name, phone }) {
      // id — по времени, как в файловом варианте; при совпадении берём следующую миллисекунду.
      for (let ts = Date.now(), attempt = 0; attempt < 5; attempt++, ts++) {
        const id = `L-${ts}`;
        const rows = await sql`
          INSERT INTO leads (id, apartment_id, name, phone)
          VALUES (${id}, ${apartmentId}, ${name}, ${phone})
          ON CONFLICT (id) DO NOTHING
          RETURNING created_at`;
        if (rows.length) return { id, apartmentId, name, phone, createdAt: new Date(rows[0].created_at).toISOString() };
      }
      throw new Error('Не удалось сохранить заявку');
    },
  };
}

export const databaseUrl = () => process.env.DATABASE_URL || process.env.POSTGRES_URL || '';

// База, если задан её адрес, иначе файлы.
export function createStore({ dataDir, url = databaseUrl() } = {}) {
  return url ? createNeonStore(url) : createFileStore(dataDir);
}
