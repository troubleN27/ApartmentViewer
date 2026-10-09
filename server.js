import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { planArea, calcPrice } from './public/js/model.js';
import { createStore, createFileStore } from './lib/store.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const modules = path.join(__dirname, 'node_modules');
const PHONE_RE = /^\+998\d{9}$/;

// dataDir задаёт файловое хранилище явно (так делают тесты).
// Без него: база Neon, если есть DATABASE_URL, иначе файлы в data/.
export function createApp({ dataDir, store = dataDir ? createFileStore(dataDir) : createStore({ dataDir: path.join(__dirname, 'data') }) } = {}) {
  const app = express();

  app.use(express.json({ limit: '10kb' }));

  // Локально three и шрифты раздаются прямо из node_modules.
  // На Vercel их копирует в public/vendor сборка (scripts/build.js), а статику отдаёт CDN.
  app.use('/vendor/three', express.static(path.join(modules, 'three')));
  app.use('/vendor/fonts/manrope', express.static(path.join(modules, '@fontsource', 'manrope')));
  app.use('/vendor/fonts/cormorant', express.static(path.join(modules, '@fontsource', 'cormorant-garamond')));
  app.use(express.static(path.join(__dirname, 'public')));

  // Список без планов; площадь и цена вычисляются.
  app.get('/api/apartments', async (req, res, next) => {
    try {
      const apartments = await store.listApartments();
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
      const apartment = await store.getApartment(req.params.id);
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
      const apartment = typeof body.apartmentId === 'string' ? await store.getApartment(body.apartmentId) : null;
      if (!apartment) return fail('apartment', 'Квартира не найдена');
      if (apartment.status === 'sold') return fail('sold', 'Квартира уже продана');

      res.status(201).json(await store.addLead({ apartmentId: apartment.id, name, phone }));
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
