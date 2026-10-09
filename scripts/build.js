// Сборка для Vercel: копирует three и шрифты из node_modules в public/vendor.
// Локально это не нужно — server.js раздаёт их прямо из node_modules по тем же адресам.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const modules = path.join(root, 'node_modules');
const vendor = path.join(root, 'public', 'vendor');

function copy(from, to) {
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.cpSync(from, to, { recursive: true });
}

fs.rmSync(vendor, { recursive: true, force: true });

// three: ядро и два контрола, которые подключает importmap в index.html.
for (const file of ['build/three.module.js', 'build/three.core.js', 'examples/jsm/controls/OrbitControls.js', 'examples/jsm/controls/PointerLockControls.js']) {
  copy(path.join(modules, 'three', file), path.join(vendor, 'three', file));
}

// Шрифты: стили нужных начертаний и сами файлы.
const fonts = {
  manrope: ['@fontsource/manrope', ['400.css', '500.css', '600.css']],
  cormorant: ['@fontsource/cormorant-garamond', ['400.css', '500.css']],
};
for (const [name, [pkg, styles]] of Object.entries(fonts)) {
  for (const file of [...styles, 'files']) {
    copy(path.join(modules, pkg, file), path.join(vendor, 'fonts', name, file));
  }
}

const size = (dir) =>
  fs.readdirSync(dir, { withFileTypes: true }).reduce((sum, e) => {
    const p = path.join(dir, e.name);
    return sum + (e.isDirectory() ? size(p) : fs.statSync(p).size);
  }, 0);
console.log(`public/vendor готов: ${(size(vendor) / 1024 / 1024).toFixed(1)} МБ`);
