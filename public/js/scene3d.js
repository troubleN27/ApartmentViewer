// 3D-сцена квартиры из тех же данных, что и 2D: стены с проёмами, пол, потолок, подписи.
// Режим облёта (OrbitControls) и запуск прогулки (walk.js).
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { wallBoxes } from './model.js';
import { createWalk } from './walk.js';

const S = 0.01; // см → м

function canvasTexture(size, paint) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  paint(canvas.getContext('2d'), size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

// Детерминированный шум для текстур.
function noise(ctx, size, count, alpha) {
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < count; i++) {
    ctx.fillStyle = `rgba(${rnd() < 0.5 ? '0,0,0' : '255,255,255'},${rnd() * alpha})`;
    ctx.fillRect(rnd() * size, rnd() * size, 1 + rnd() * 3, 1 + rnd() * 3);
  }
}

// Текстуры пола; size — сторона тайла в метрах.
const FLOORS = {
  laminate: {
    size: 1.6,
    paint(ctx, n) {
      const tones = ['#C9A57A', '#C19C70', '#CDAA80', '#BC966A'];
      const rows = 8;
      for (let r = 0; r < rows; r++) {
        const shift = (r % 2) * (n / 2) + ((r * 37) % 50);
        for (let k = -1; k < 2; k++) {
          ctx.fillStyle = tones[(r * 3 + k + 4) % tones.length];
          ctx.fillRect(k * n + shift, (r * n) / rows, n, n / rows);
          ctx.fillStyle = 'rgba(70,45,20,.35)';
          ctx.fillRect(k * n + shift, (r * n) / rows, 1.5, n / rows);
        }
        ctx.fillStyle = 'rgba(70,45,20,.3)';
        ctx.fillRect(0, (r * n) / rows, n, 1.5);
      }
      noise(ctx, n, 1400, 0.05);
    },
  },
  tile: {
    size: 1.2,
    paint(ctx, n) {
      ctx.fillStyle = '#D9DEDC';
      ctx.fillRect(0, 0, n, n);
      noise(ctx, n, 600, 0.04);
      ctx.fillStyle = '#B4BAB8';
      for (let i = 0; i < 2; i++) {
        ctx.fillRect((i * n) / 2, 0, 2, n);
        ctx.fillRect(0, (i * n) / 2, n, 2);
      }
    },
  },
  concrete: {
    size: 2.4,
    paint(ctx, n) {
      ctx.fillStyle = '#A9A7A2';
      ctx.fillRect(0, 0, n, n);
      noise(ctx, n, 5000, 0.07);
    },
  },
};

const PALETTE = {
  whitebox: { wall: 0xbdbab4, ceiling: 0xcfccc6, door: 0x8d8a84, floor: () => 'concrete' },
  finish: {
    wall: 0xf4eee3,
    ceiling: 0xfbf8f2,
    door: 0x6f4d31,
    floor: (type) => (type === 'bathroom' ? 'tile' : 'laminate'),
  },
};

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
  const materials = {
    wall: new THREE.MeshStandardMaterial({ color: palette.wall, roughness: 0.92 }),
    entrance: new THREE.MeshStandardMaterial({ color: palette.door, roughness: 0.6 }),
    glass: new THREE.MeshStandardMaterial({
      color: 0xbcd6de,
      roughness: 0.08,
      metalness: 0.1,
      transparent: true,
      opacity: 0.3,
      depthWrite: false,
    }),
    ceiling: new THREE.MeshStandardMaterial({ color: palette.ceiling, roughness: 1 }),
  };

  for (const b of wallBoxes(plan)) {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry((b.x1 - b.x0) * S, (b.z1 - b.z0) * S, (b.y1 - b.y0) * S),
      materials[b.kind],
    );
    mesh.position.set(((b.x0 + b.x1) / 2) * S, ((b.z0 + b.z1) / 2) * S, ((b.y0 + b.y1) / 2) * S);
    if (b.kind === 'glass') mesh.renderOrder = 1;
    group.add(mesh);
  }

  for (const room of plan.rooms) {
    const kind = palette.floor(room.type);
    materials[kind] ||= new THREE.MeshStandardMaterial({ map: textures[kind], roughness: kind === 'tile' ? 0.35 : 0.75 });
    const geometry = new THREE.PlaneGeometry(room.w * S, room.l * S);
    // UV в метрах, чтобы рисунок пола не растягивался.
    const uv = geometry.attributes.uv;
    const tile = FLOORS[kind].size;
    for (let i = 0; i < uv.count; i++) {
      uv.setXY(i, ((room.x + uv.getX(i) * room.w) * S) / tile, ((room.y + uv.getY(i) * room.l) * S) / tile);
    }
    const floor = new THREE.Mesh(geometry, materials[kind]);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set((room.x + room.w / 2) * S, 0, (room.y + room.l / 2) * S);
    group.add(floor);
  }

  const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(plan.width * S, plan.length * S), materials.ceiling);
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

export function createTextures() {
  return Object.fromEntries(Object.entries(FLOORS).map(([k, f]) => [k, canvasTexture(256, f.paint)]));
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
  camera.position.set(center.x + span * 0.35, span * 1.15, center.z + span * 0.95);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.copy(center);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = 2;
  controls.maxDistance = span * 3;
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
