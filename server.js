import express from 'express';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { planArea, calcPrice } from './public/js/model.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const modules = path.join(__dirname, 'node_modules');
const PHONE_RE = /^\+998\d{9}$/;

async function readJson(file, fallback) {
  try {
    return JSON.parse(await fs.readFile(file, 'utf8'));
  } catch (err) {
    if (err.code === 'ENOENT' && fallback !== undefined) return fallback;
    throw err;
  }
}

export function createApp({ dataDir = path.join(__dirname, 'data') } = {}) {
  const app = express();
  const apartmentsFile = path.join(dataDir, 'apartments.json');
  const leadsFile = path.join(dataDir, 'leads.json');
  let writeQueue = Promise.resolve();

  app.use(express.json({ limit: '10kb' }));

  app.use('/vendor/three', express.static(path.join(modules, 'three')));
  app.use('/vendor/fonts/manrope', express.static(path.join(modules, '@fontsource', 'manrope')));
  app.use('/vendor/fonts/cormorant', express.static(path.join(modules, '@fontsource', 'cormorant-garamond')));
  app.use(express.static(path.join(__dirname, 'public')));

  // Список без планов; площадь и цена вычисляются.
  app.get('/api/apartments', async (req, res, next) => {
    try {
      const apartments = await readJson(apartmentsFile, []);
      res.json(
        apartments.map(({ id, floor, number, rooms, pricePerM2, status, plan }) => {
          const area = planArea(plan);
          return { id, floor, number, rooms, area, price: calcPrice(area, pricePerM2), status };
        }),
      );
    } catch (err) {
      next(err);
    }
  });

  app.get('/api/apartments/:id', async (req, res, next) => {
    try {
      const apartment = (await readJson(apartmentsFile, [])).find((a) => a.id === req.params.id);
      if (!apartment) return res.status(404).json({ error: 'Квартира не найдена', code: 'apartment' });
      res.json(apartment);
    } catch (err) {
      next(err);
    }
  });

  app.post('/api/leads', async (req, res, next) => {
    try {
      const body = req.body || {};
      const name = typeof body.name === 'string' ? body.name.trim() : '';
      const phone = typeof body.phone === 'string' ? body.phone.trim() : '';
      const fail = (code, error) => res.status(400).json({ error, code });

      if (name.length < 2 || name.length > 60) return fail('name', 'Имя должно быть от 2 до 60 символов');
      if (!PHONE_RE.test(phone)) return fail('phone', 'Телефон должен быть в формате +998XXXXXXXXX');
      const apartment = (await readJson(apartmentsFile, [])).find((a) => a.id === body.apartmentId);
      if (!apartment) return fail('apartment', 'Квартира не найдена');
      if (apartment.status === 'sold') return fail('sold', 'Квартира уже продана');

      const lead = {
        id: `L-${Date.now()}`,
        apartmentId: apartment.id,
        name,
        phone,
        createdAt: new Date().toISOString(),
      };
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
      res.status(201).json(lead);
    } catch (err) {
      next(err);
    }
  });

  app.use('/api', (req, res) => res.status(404).json({ error: 'Маршрут не найден' }));

  app.use((err, req, res, next) => {
    if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Некорректный JSON' });
    console.error(err);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  });

  return app;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const port = process.env.PORT || 3000;
  createApp().listen(port, () => console.log(`http://localhost:${port}`));
}
