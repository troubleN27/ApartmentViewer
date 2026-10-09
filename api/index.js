// Точка входа для Vercel: все запросы /api/* обрабатывает то же Express-приложение.
// Статику (public/) Vercel раздаёт сам, см. vercel.json.
import { createApp } from '../server.js';

export default createApp();
