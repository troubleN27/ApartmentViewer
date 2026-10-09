// 3D-сцена квартиры из тех же данных, что и 2D: стены с проёмами, пол, потолок, подписи.
// Режим облёта (OrbitControls) и запуск прогулки (walk.js).
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { wallBoxes } from './model.js';
import { createWalk } from './walk.js';

const S = 0.01; // см → м
const TEX = 512; // сторона текстуры, px

// Детерминированный генератор для рисунка текстур.
function seeded(seed) {
  return () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
}

// Мелкое зерно: светлые и тёмные точки.
function grain(ctx, n, count, alpha, rnd = seeded(7)) {
  for (let i = 0; i < count; i++) {
    ctx.fillStyle = `rgba(${rnd() < 0.5 ? '0,0,0' : '255,255,255'},${rnd() * alpha})`;
    ctx.fillRect(rnd() * n, rnd() * n, 1 + rnd() * 2, 1 + rnd() * 2);
  }
}

// Крупные мягкие пятна — неоднородность тона.
function blotches(ctx, n, count, alpha, rnd = seeded(11)) {
  for (let i = 0; i < count; i++) {
    const x = rnd() * n;
    const y = rnd() * n;
    const r = n * (0.08 + rnd() * 0.18);
    const dark = rnd() < 0.5;
    // Рисуем с переносом через край, чтобы тайл стыковался без шва.
    for (const dx of [-n, 0, n]) {
      for (const dy of [-n, 0, n]) {
        const g = ctx.createRadialGradient(x + dx, y + dy, 0, x + dx, y + dy, r);
        g.addColorStop(0, `rgba(${dark ? '0,0,0' : '255,255,255'},${alpha})`);
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.fillRect(x + dx - r, y + dy - r, r * 2, r * 2);
      }
    }
  }
}

// Процедурные текстуры. size — сторона тайла в метрах.
const TEXTURES = {
  // Ламинат: доски вразбежку с волокнами.
  laminate: {
    size: 1.6,
    roughness: 0.62,
    paint(ctx, n) {
      const rnd = seeded(3);
      const tones = ['#C9A57A', '#C19C70', '#CDAA80', '#BC966A', '#C6A075'];
      const rows = 8;
      const rh = n / rows;
      for (let r = 0; r < rows; r++) {
        const shift = Math.floor(rnd() * n);
        for (let k = -1; k < 2; k++) {
          const x = k * n + shift;
          ctx.fillStyle = tones[Math.floor(rnd() * tones.length)];
          ctx.fillRect(x, r * rh, n, rh);
          // Волокна вдоль доски.
          for (let i = 0; i < 26; i++) {
            ctx.fillStyle = `rgba(${rnd() < 0.6 ? '84,52,22' : '255,236,205'},${0.04 + rnd() * 0.08})`;
            ctx.fillRect(x + rnd() * n, r * rh + rnd() * rh, n * (0.15 + rnd() * 0.5), 1);
          }
          ctx.fillStyle = 'rgba(58,36,14,.55)';
          ctx.fillRect(x, r * rh, 2, rh);
        }
        ctx.fillStyle = 'rgba(58,36,14,.5)';
        ctx.fillRect(0, r * rh, n, 2);
      }
      grain(ctx, n, 2500, 0.04);
    },
  },
  // Напольная плитка 60×60 с затиркой.
  tile: {
    size: 1.2,
    roughness: 0.3,
    paint(ctx, n) {
      const rnd = seeded(5);
      const half = n / 2;
      for (let i = 0; i < 2; i++) {
        for (let j = 0; j < 2; j++) {
          const v = 212 + Math.floor(rnd() * 12);
          ctx.fillStyle = `rgb(${v},${v + 4},${v + 2})`;
          ctx.fillRect(i * half, j * half, half, half);
        }
      }
      blotches(ctx, n, 10, 0.05);
      grain(ctx, n, 1500, 0.03);
      ctx.fillStyle = '#A9B0AE';
      for (let i = 0; i < 2; i++) {
        ctx.fillRect(i * half - 2, 0, 4, n);
        ctx.fillRect(0, i * half - 2, n, 4);
      }
      ctx.fillRect(n - 2, 0, 2, n);
      ctx.fillRect(0, n - 2, n, 2);
    },
  },
  // Настенная плитка 30×60 в санузле.
  wallTile: {
    size: 1.2,
    roughness: 0.22,
    paint(ctx, n) {
      const rnd = seeded(9);
      const tw = n / 2;
      const th = n / 4;
      for (let r = 0; r < 4; r++) {
        for (let c = -1; c < 2; c++) {
          const x = c * tw + (r % 2) * (tw / 2);
          const v = 226 + Math.floor(rnd() * 10);
          ctx.fillStyle = `rgb(${v},${v + 3},${v - 1})`;
          ctx.fillRect(x, r * th, tw, th);
          ctx.fillStyle = '#B9C0BD';
          ctx.fillRect(x, r * th, 3, th);
        }
        ctx.fillStyle = '#B9C0BD';
        ctx.fillRect(0, r * th, n, 3);
      }
      grain(ctx, n, 800, 0.025);
    },
  },
  // Тёплая штукатурка.
  plaster: {
    size: 2,
    roughness: 0.95,
    paint(ctx, n) {
      ctx.fillStyle = '#F5EFE3';
      ctx.fillRect(0, 0, n, n);
      blotches(ctx, n, 26, 0.016);
      grain(ctx, n, 9000, 0.03);
    },
  },
  // Фасад: крупные каменные плиты.
  facade: {
    size: 2.4,
    roughness: 0.9,
    paint(ctx, n) {
      const rnd = seeded(13);
      const rows = 4;
      const rh = n / rows;
      for (let r = 0; r < rows; r++) {
        for (let c = -1; c < 3; c++) {
          const x = c * (n / 2) + (r % 2) * (n / 4);
          const v = Math.floor(rnd() * 14);
          ctx.fillStyle = `rgb(${206 + v},${192 + v},${170 + v})`;
          ctx.fillRect(x, r * rh, n / 2, rh);
          ctx.fillStyle = 'rgba(96,82,62,.6)';
          ctx.fillRect(x, r * rh, 3, rh);
        }
        ctx.fillStyle = 'rgba(96,82,62,.6)';
        ctx.fillRect(0, r * rh, n, 3);
      }
      blotches(ctx, n, 18, 0.05);
      grain(ctx, n, 7000, 0.06);
    },
  },
  // Шпон входной двери: вертикальные волокна.
  wood: {
    size: 1,
    roughness: 0.5,
    paint(ctx, n) {
      const rnd = seeded(17);
      ctx.fillStyle = '#6F4D31';
      ctx.fillRect(0, 0, n, n);
      for (let i = 0; i < 220; i++) {
        ctx.fillStyle = `rgba(${rnd() < 0.55 ? '38,22,10' : '176,128,84'},${0.05 + rnd() * 0.12})`;
        ctx.fillRect(rnd() * n, 0, 1 + rnd() * 2, n);
      }
      grain(ctx, n, 2000, 0.04);
    },
  },
  // Бетонный пол.
  concrete: {
    size: 2.4,
    roughness: 0.95,
    paint(ctx, n) {
      ctx.fillStyle = '#BDBBB5';
      ctx.fillRect(0, 0, n, n);
      blotches(ctx, n, 30, 0.04);
      grain(ctx, n, 14000, 0.06);
    },
  },
  // Бетонная стена: щиты опалубки и отверстия от стяжек.
  concreteWall: {
    size: 2.4,
    roughness: 0.95,
    paint(ctx, n) {
      ctx.fillStyle = '#D2CFC9';
      ctx.fillRect(0, 0, n, n);
      blotches(ctx, n, 30, 0.035, seeded(23));
      grain(ctx, n, 12000, 0.05, seeded(29));
      ctx.fillStyle = 'rgba(70,68,64,.3)';
      for (let i = 0; i < 2; i++) {
        ctx.fillRect((i * n) / 2, 0, 2, n);
        ctx.fillRect(0, (i * n) / 2, n, 2);
      }
      ctx.fillStyle = 'rgba(60,58,54,.4)';
      for (const x of [n / 8, (3 * n) / 8, (5 * n) / 8, (7 * n) / 8]) {
        for (const y of [n / 8, (3 * n) / 8, (5 * n) / 8, (7 * n) / 8]) {
          ctx.beginPath();
          ctx.arc(x, y, 4, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    },
  },
};

// Отделка: какая текстура у стены в комнате данного типа (null — улица), у пола и двери.
const PALETTE = {
  whitebox: {
    wall: () => 'concreteWall',
    floor: () => 'concrete',
    door: 'concreteWall',
    cut: 0xa9a6a0, // срез стены сверху
    ceiling: 0xcfccc6,
  },
  finish: {
    wall: (type) => (type === null ? 'facade' : type === 'bathroom' ? 'wallTile' : 'plaster'),
    floor: (type) => (type === 'bathroom' ? 'tile' : 'laminate'),
    door: 'wood',
    cut: 0xe6dfd2,
    ceiling: 0xfbf8f2,
  },
};

export function createTextures() {
  return Object.fromEntries(
    Object.entries(TEXTURES).map(([key, def]) => {
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = TEX;
      def.paint(canvas.getContext('2d'), TEX);
      const texture = new THREE.CanvasTexture(canvas);
      texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = 8;
      return [key, texture];
    }),
  );
}

// UV по мировым координатам (в метрах): рисунок не растягивается и совпадает
// на перекрывающихся гранях соседних кусков стены. tiles — размер тайла для каждой из 6 граней.
function worldUV(geometry, cx, cy, cz, tiles) {
  const pos = geometry.attributes.position;
  const nor = geometry.attributes.normal;
  const uv = geometry.attributes.uv;
  for (let i = 0; i < uv.count; i++) {
    const tile = tiles[Math.floor(i / 4)];
    const x = pos.getX(i) + cx;
    const y = pos.getY(i) + cy;
    const z = pos.getZ(i) + cz;
    if (Math.abs(nor.getX(i)) > 0.5) uv.setXY(i, z / tile, y / tile);
    else if (Math.abs(nor.getY(i)) > 0.5) uv.setXY(i, x / tile, z / tile);
    else uv.setXY(i, x / tile, y / tile);
  }
}

function makeLabel(lines) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 192;
  const ctx = canvas.getContext('2d');
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(28,29,33,.78)';
  ctx.beginPath();
  ctx.roundRect(36, 28, 440, 136, 10);
  ctx.fill();
  ctx.fillStyle = '#F7F4EE';
  ctx.font = '600 50px Manrope, sans-serif';
  ctx.fillText(lines[0], 256, 76, 400);
  ctx.fillStyle = '#D9BC8A';
  ctx.font = '500 38px Manrope, sans-serif';
  ctx.fillText(lines[1], 256, 128, 400);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false }));
  sprite.renderOrder = 2;
  return sprite;
}

// Группа с геометрией квартиры. Отдельная функция — её же прогоняет проверка генератора.
export function buildApartment(plan, finish, textures) {
  const palette = PALETTE[finish] || PALETTE.finish;
  const group = new THREE.Group();
  const typeOf = new Map(plan.rooms.map((r) => [r.id, r.type]));

  const materials = {};
  // Карту рельефа не используем: мелкое зерно в ней даёт блики, которые мерцают при движении камеры.
  const textured = (key) =>
    (materials[key] ||= new THREE.MeshStandardMaterial({ map: textures[key], roughness: TEXTURES[key].roughness }));
  const cut = (materials.cut = new THREE.MeshStandardMaterial({ color: palette.cut, roughness: 1 }));
  const glass = (materials.glass = new THREE.MeshStandardMaterial({
    color: 0xbcd6de,
    roughness: 0.08,
    metalness: 0.1,
    transparent: true,
    opacity: 0.3,
    depthWrite: false,
  }));
  const ceilingMaterial = (materials.ceiling = new THREE.MeshStandardMaterial({ color: palette.ceiling, roughness: 1 }));

  for (const b of wallBoxes(plan)) {
    const geometry = new THREE.BoxGeometry((b.x1 - b.x0) * S, (b.z1 - b.z0) * S, (b.y1 - b.y0) * S);
    const cx = ((b.x0 + b.x1) / 2) * S;
    const cy = ((b.z0 + b.z1) / 2) * S;
    const cz = ((b.y0 + b.y1) / 2) * S;
    let material;
    if (b.kind === 'glass') {
      material = glass;
    } else if (b.kind === 'entrance') {
      material = textured(palette.door);
      worldUV(geometry, cx, cy, cz, Array(6).fill(TEXTURES[palette.door].size));
    } else {
      // Отделка грани — по комнате, к которой она обращена; торцы проёмов — как внутренняя стена.
      const face = (id) => palette.wall(id === undefined ? 'hall' : id === null ? null : typeOf.get(id));
      const f = b.faces;
      // Порядок граней BoxGeometry: +x, -x, +y (срез), -y, +z, -z.
      const keys = [face(f.xp), face(f.xn), null, face(undefined), face(f.yp), face(f.yn)];
      material = keys.map((key) => (key ? textured(key) : cut));
      worldUV(geometry, cx, cy, cz, keys.map((key) => (key ? TEXTURES[key].size : 1)));
    }
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(cx, cy, cz);
    if (b.kind === 'glass') mesh.renderOrder = 1;
    group.add(mesh);
  }

  for (const room of plan.rooms) {
    const key = palette.floor(room.type);
    const geometry = new THREE.PlaneGeometry(room.w * S, room.l * S);
    // UV в метрах, чтобы рисунок пола не растягивался.
    const uv = geometry.attributes.uv;
    const tile = TEXTURES[key].size;
    for (let i = 0; i < uv.count; i++) {
      uv.setXY(i, ((room.x + uv.getX(i) * room.w) * S) / tile, ((room.y + uv.getY(i) * room.l) * S) / tile);
    }
    const floor = new THREE.Mesh(geometry, textured(key));
    floor.rotation.x = -Math.PI / 2;
    floor.position.set((room.x + room.w / 2) * S, 0, (room.y + room.l / 2) * S);
    group.add(floor);
  }

  const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(plan.width * S, plan.length * S), ceilingMaterial);
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.set((plan.width / 2) * S, plan.height * S, (plan.length / 2) * S);
  ceiling.name = 'ceiling';
  group.add(ceiling);

  group.userData.dispose = () => {
    group.traverse((o) => o.geometry?.dispose());
    Object.values(materials).forEach((m) => m.dispose());
  };
  return group;
}

export function createViewer({ container, plan, finish, labelOf, onPlayer, onModeChange, onLock }) {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const BG = { orbit: new THREE.Color(0xe9e3d8), walk: new THREE.Color(0xdde7ec) };
  scene.background = BG.orbit;

  const W = plan.width * S;
  const L = plan.length * S;
  const H = plan.height * S;
  const span = Math.max(W, L);
  const center = new THREE.Vector3(W / 2, 0, L / 2);

  const camera = new THREE.PerspectiveCamera(45, 1, 0.05, 200);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.copy(center);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = 2;
  controls.maxDistance = span * 6;
  controls.maxPolarAngle = Math.PI / 2 - 0.06;
  controls.update();

  // Мягкий тёплый свет: небо + солнце со стороны окон.
  scene.add(new THREE.HemisphereLight(0xfffaf0, 0xe0d8cc, 2.4));
  const sun = new THREE.DirectionalLight(0xffe9cc, 0.9);
  const out = new THREE.Vector3();
  for (const o of plan.openings) {
    if (o.type !== 'window') continue;
    if (o.dir === 'h') out.z += o.y === 0 ? -1 : 1;
    else out.x += o.x === 0 ? -1 : 1;
  }
  if (out.lengthSq() === 0) out.set(1, 0, 1);
  out.normalize().multiplyScalar(span * 1.5);
  sun.position.set(center.x + out.x, span * 1.6, center.z + out.z);
  sun.target.position.copy(center);
  scene.add(sun, sun.target);

  const textures = createTextures();
  let apartment = null;
  let ceiling = null;
  const labels = new THREE.Group();
  scene.add(labels);

  let mode = 'orbit';
  let walk = null;
  let leftWalkAt = -Infinity;
  let disposed = false;
  const orbitState = { position: camera.position.clone(), target: center.clone() };

  function placeLabels() {
    labels.children.forEach((sprite) => {
      const walking = mode === 'walk';
      sprite.position.y = walking ? H - 0.42 : H + 0.3;
      const k = walking ? 0.5 : 1;
      sprite.scale.set(1.6 * k, 0.6 * k, 1);
      sprite.material.depthTest = walking;
    });
  }

  function refreshLabels() {
    labels.children.forEach((s) => {
      s.material.map.dispose();
      s.material.dispose();
    });
    labels.clear();
    for (const room of plan.rooms) {
      const sprite = makeLabel(labelOf(room));
      sprite.position.set((room.x + room.w / 2) * S, 0, (room.y + room.l / 2) * S);
      labels.add(sprite);
    }
    placeLabels();
  }

  function setFinish(next) {
    if (apartment) {
      scene.remove(apartment);
      apartment.userData.dispose();
    }
    apartment = buildApartment(plan, next, textures);
    ceiling = apartment.getObjectByName('ceiling');
    ceiling.visible = mode === 'walk';
    scene.add(apartment);
  }

  function resize() {
    const w = container.clientWidth || 1;
    const h = container.clientHeight || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  function setMode(next, { eyeHeight } = {}) {
    if (next === mode || disposed) return;
    if (next === 'walk') {
      if (!eyeHeight) return; // без роста прогулка не запускается
      orbitState.position.copy(camera.position);
      orbitState.target.copy(controls.target);
      controls.enabled = false;
      mode = 'walk';
      camera.fov = 72;
      camera.updateProjectionMatrix();
      walk = createWalk({
        camera,
        domElement: renderer.domElement,
        plan,
        eyeHeight,
        onMove: onPlayer,
        onLock,
        onExit: () => setMode('orbit'),
      });
      walk.start();
    } else {
      mode = 'orbit';
      leftWalkAt = performance.now();
      walk?.stop();
      walk = null;
      camera.fov = 45;
      camera.updateProjectionMatrix();
      camera.position.copy(orbitState.position);
      controls.target.copy(orbitState.target);
      controls.enabled = true;
      controls.update();
    }
    scene.background = BG[mode];
    ceiling.visible = mode === 'walk';
    placeLabels();
    onModeChange?.(mode);
  }

  let last = performance.now();
  function frame(now) {
    if (disposed) return;
    const dt = Math.max(0, (now - last) / 1000);
    last = now;
    if (walk) walk.update(dt);
    else controls.update();
    renderer.render(scene, camera);
  }

  setFinish(finish);
  refreshLabels();
  resize();
  // На узком экране отодвигаем камеру, чтобы квартира помещалась целиком.
  const fit = Math.max(1, 1.25 / camera.aspect);
  camera.position.set(center.x + span * 0.35 * fit, span * 1.15 * fit, center.z + span * 0.95 * fit);
  controls.update();
  const observer = new ResizeObserver(resize);
  observer.observe(container);
  window.addEventListener('resize', resize);
  document.fonts?.ready.then(() => !disposed && refreshLabels());
  renderer.setAnimationLoop(frame);

  return {
    setFinish,
    setMode,
    refreshLabels,
    resize,
    getMode: () => mode,
    // Сразу после выхода из прогулки Esc/fullscreenchange не должны закрывать сцену.
    justLeftWalk: () => performance.now() - leftWalkAt < 700,
    // Для проверок: шаг симуляции без ожидания кадра.
    debug: { camera, scene, step: (dt) => walk?.update(dt), position: () => walk?.getPosition() },
    dispose() {
      disposed = true;
      renderer.setAnimationLoop(null);
      walk?.stop();
      observer.disconnect();
      window.removeEventListener('resize', resize);
      controls.dispose();
      apartment.userData.dispose();
      labels.children.forEach((s) => {
        s.material.map.dispose();
        s.material.dispose();
      });
      Object.values(textures).forEach((tx) => tx.dispose());
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
