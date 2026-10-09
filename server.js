import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const modules = path.join(__dirname, 'node_modules');

export function createApp() {
  const app = express();
  app.use(express.json({ limit: '10kb' }));

  app.use('/vendor/three', express.static(path.join(modules, 'three')));
  app.use('/vendor/fonts/manrope', express.static(path.join(modules, '@fontsource', 'manrope')));
  app.use('/vendor/fonts/cormorant', express.static(path.join(modules, '@fontsource', 'cormorant-garamond')));
  app.use(express.static(path.join(__dirname, 'public')));

  return app;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const port = process.env.PORT || 3000;
  createApp().listen(port, () => console.log(`http://localhost:${port}`));
}
