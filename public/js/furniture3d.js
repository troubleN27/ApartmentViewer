// 3D-модели мебели: собираются из деталей каталога (furniture.js) — коробок, цилиндров и сфер.
import * as THREE from 'three';
import { CATALOG, MATERIALS } from './furniture.js';
import { seeded, grain, blotches, paintCanvas } from './textures.js';

const S = 0.01; // см → м

// Текстуры почти белые — цвет задаёт материал. size — сторона тайла в метрах.
const TEXTURES = {
  // Древесина: волокна вдоль вертикали текстуры.
  grain: {
    size: 0.9,
    paint(ctx, n) {
      const rnd = seeded(31);
      ctx.fillStyle = '#F4F0EA';
      ctx.fillRect(0, 0, n, n);
      for (let i = 0; i < 260; i++) {
        ctx.fillStyle = `rgba(${rnd() < 0.7 ? '70,45,20' : '255,255,255'},${0.03 + rnd() * 0.1})`;
        ctx.fillRect(rnd() * n, 0, 1 + rnd() * 2.5, n);
      }
      // Редкие годовые кольца.
      ctx.strokeStyle = 'rgba(70,45,20,.12)';
      for (let i = 0; i < 5; i++) {
        const x = rnd() * n;
        ctx.beginPath();
        ctx.ellipse(x, n / 2, 6 + rnd() * 10, n * (0.3 + rnd() * 0.3), 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      grain(ctx, n, 1200, 0.03);
    },
  },
  // Ткань: мелкое переплетение.
  weave: {
    size: 0.25,
    paint(ctx, n) {
      ctx.fillStyle = '#F2F0EC';
      ctx.fillRect(0, 0, n, n);
      const step = 8;
      for (let y = 0; y < n; y += step) {
        for (let x = 0; x < n; x += step) {
          const even = (x / step + y / step) % 2 === 0;
          ctx.fillStyle = even ? 'rgba(0,0,0,.09)' : 'rgba(255,255,255,.5)';
          ctx.fillRect(x, y, even ? step : step - 2, even ? step - 2 : step);
        }
      }
      grain(ctx, n, 2500, 0.05);
    },
  },
  // Камень столешницы.
  stone: {
    size: 0.8,
    paint(ctx, n) {
      const rnd = seeded(37);
      ctx.fillStyle = '#F5F3EF';
      ctx.fillRect(0, 0, n, n);
      blotches(ctx, n, 16, 0.05, seeded(41));
      for (let i = 0; i < 900; i++) {
        ctx.fillStyle = `rgba(${rnd() < 0.6 ? '60,56,50' : '255,255,255'},${0.1 + rnd() * 0.25})`;
        ctx.fillRect(rnd() * n, rnd() * n, 1 + rnd() * 2, 1 + rnd() * 2);
      }
    },
  },
  // Шлифованная сталь.
  brushed: {
    size: 0.6,
    paint(ctx, n) {
      const rnd = seeded(43);
      ctx.fillStyle = '#F1F2F3';
      ctx.fillRect(0, 0, n, n);
      for (let i = 0; i < 500; i++) {
        ctx.fillStyle = `rgba(${rnd() < 0.5 ? '0,0,0' : '255,255,255'},${0.01 + rnd() * 0.03})`;
        ctx.fillRect(0, rnd() * n, n, 1);
      }
    },
  },
  // Ковёр: поле с каймой и ромбами, ложится на предмет целиком.
  rug: {
    fit: true,
    paint(ctx, n) {
      ctx.fillStyle = '#DCCFBB';
      ctx.fillRect(0, 0, n, n);
      ctx.fillStyle = '#7E8A84';
      ctx.fillRect(n * 0.04, n * 0.06, n * 0.92, n * 0.88);
      ctx.fillStyle = '#E6DCCB';
      ctx.fillRect(n * 0.07, n * 0.1, n * 0.86, n * 0.8);
      ctx.strokeStyle = '#B8955A';
      ctx.lineWidth = 2;
      ctx.strokeRect(n * 0.1, n * 0.15, n * 0.8, n * 0.7);
      ctx.strokeStyle = 'rgba(126,138,132,.7)';
      for (let i = 0; i < 6; i++) {
        const cx = n * (0.2 + i * 0.12);
        ctx.beginPath();
        ctx.moveTo(cx, n * 0.3);
        ctx.lineTo(cx + n * 0.05, n * 0.5);
        ctx.lineTo(cx, n * 0.7);
        ctx.lineTo(cx - n * 0.05, n * 0.5);
        ctx.closePath();
        ctx.stroke();
      }
      grain(ctx, n, 6000, 0.07);
    },
  },
};

// Общие для сцены текстуры и материалы мебели.
export function createFurnitureAssets() {
  const textures = Object.fromEntries(
    Object.entries(TEXTURES).map(([key, def]) => {
      const texture = new THREE.CanvasTexture(paintCanvas(256, def.paint));
      texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = 8;
      return [key, texture];
    }),
  );

  // Мягкая тень под предметом вместо настоящих теней.
  const shadowMap = new THREE.CanvasTexture(
    paintCanvas(128, (ctx, n) => {
      const pad = n * 0.22;
      ctx.filter = `blur(${n * 0.07}px)`;
      ctx.fillStyle = '#000';
      ctx.fillRect(pad, pad, n - 2 * pad, n - 2 * pad);
    }),
  );
  const shadow = new THREE.MeshBasicMaterial({
    map: shadowMap,
    transparent: true,
    opacity: 0.5,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });

  const materials = {};
  const material = (key) => {
    if (materials[key]) return materials[key];
    const def = MATERIALS[key];
    const mat = new THREE.MeshStandardMaterial({
      color: def.color,
      map: def.tex ? textures[def.tex] : null,
      roughness: def.rough ?? 0.7,
      metalness: def.metal ?? 0,
    });
    if (def.opacity) {
      mat.transparent = true;
      mat.opacity = def.opacity;
      mat.depthWrite = false;
    }
    if (def.emissive) mat.emissive = new THREE.Color(def.emissive);
    return (materials[key] = mat);
  };

  return {
    material,
    shadow,
    dispose() {
      Object.values(textures).forEach((tx) => tx.dispose());
      Object.values(materials).forEach((m) => m.dispose());
      shadowMap.dispose();
      shadow.dispose();
    },
  };
}

// UV в метрах по собственным координатам детали: рисунок не растягивается.
function scaleUV(geometry, tile) {
  const pos = geometry.attributes.position;
  const nor = geometry.attributes.normal;
  const uv = geometry.attributes.uv;
  for (let i = 0; i < uv.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    if (Math.abs(nor.getX(i)) > 0.5) uv.setXY(i, z / tile, y / tile);
    else if (Math.abs(nor.getY(i)) > 0.5) uv.setXY(i, x / tile, z / tile);
    else uv.setXY(i, x / tile, y / tile);
  }
}

function buildItem(item, assets) {
  const def = CATALOG[item.type];
  const group = new THREE.Group();
  for (const p of def.parts) {
    const mat = MATERIALS[p.mat];
    let geometry;
    let cx = p.x;
    let cy = p.y;
    let cz;
    if (p.shape === 'box') {
      geometry = new THREE.BoxGeometry(p.sx * S, p.sz * S, p.sy * S);
      const tex = mat.tex && TEXTURES[mat.tex];
      if (tex && !tex.fit) scaleUV(geometry, tex.size);
      cx += p.sx / 2;
      cy += p.sy / 2;
      cz = p.z + p.sz / 2;
    } else if (p.shape === 'cyl') {
      geometry = new THREE.CylinderGeometry(p.rTop * S, p.r * S, p.h * S, 24);
      cz = p.z + p.h / 2;
    } else {
      geometry = new THREE.SphereGeometry(p.r * S, 14, 10);
      cz = p.z;
    }
    const mesh = new THREE.Mesh(geometry, assets.material(p.mat));
    mesh.position.set((cx - def.w / 2) * S, cz * S, (cy - def.d / 2) * S);
    if (mat.opacity) mesh.renderOrder = 1;
    group.add(mesh);
  }
  if (!def.flat) {
    const shadow = new THREE.Mesh(new THREE.PlaneGeometry((def.w + 36) * S, (def.d + 36) * S), assets.shadow);
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.004;
    group.add(shadow);
  }
  group.position.set(item.x * S, 0, item.y * S);
  group.rotation.y = (-item.rot * Math.PI) / 180;
  return group;
}

// Группа со всей мебелью квартиры.
export function buildFurniture(items, assets) {
  const group = new THREE.Group();
  for (const item of items) {
    if (CATALOG[item.type]) group.add(buildItem(item, assets));
  }
  group.userData.dispose = () => group.traverse((o) => o.geometry?.dispose());
  return group;
}
