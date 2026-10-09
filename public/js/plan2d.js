// Планировка на Canvas: комнаты, стены, проёмы, размерные линии, подсказка, точка игрока.
import { t } from './i18n.js';
import { buildWalls, wallPosts, splitWall, roomArea, roomAt, formatArea, PLAYER_R } from './model.js';
import { CATALOG, MATERIALS, footprint } from './furniture.js';

export const ROOM_COLORS = {
  living: '#3A3427',
  bedroom: '#2B352E',
  kitchen: '#3B2F28',
  bathroom: '#27353B',
  hall: '#2F3035',
};
const INK = '#ECE7DC'; // стены и подписи — светлые на тёмном
const GOLD = '#C6A46A';
const MUTED = '#A09D95';
const PAPER = '#15161A';
const FONT = 'Manrope, system-ui, sans-serif';

export function createPlanView(canvas, { tooltip = null, minimap = false } = {}) {
  const ctx = canvas.getContext('2d');
  const pad = minimap ? 10 : 40;
  let plan = null;
  let walls = [];
  let posts = [];
  let furniture = [];
  let ghost = null; // { item, ok } — предмет, который ставят или тащат
  let selected = null;
  let furnishMode = false;
  let hover = null;
  let player = null;
  let w = 0;
  let h = 0;
  let scale = 1;
  let ox = 0;
  let oy = 0;

  const px = (x) => ox + x * scale;
  const py = (y) => oy + y * scale;

  function layout() {
    const box = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    w = Math.max(1, Math.round(box.width));
    h = Math.max(1, Math.round(box.height));
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (plan) {
      scale = Math.max(0.01, Math.min((w - 2 * pad) / plan.width, (h - 2 * pad) / plan.length));
      ox = (w - plan.width * scale) / 2;
      oy = (h - plan.length * scale) / 2;
    }
  }

  function drawRooms() {
    for (const r of plan.rooms) {
      ctx.fillStyle = ROOM_COLORS[r.type];
      ctx.fillRect(px(r.x), py(r.y), r.w * scale, r.l * scale);
      if (hover === r.id) {
        ctx.fillStyle = 'rgba(198, 164, 106, .2)';
        ctx.fillRect(px(r.x), py(r.y), r.w * scale, r.l * scale);
      }
    }
  }

  // Дуга открывания: петля в начале проёма, полотно открыто внутрь на 90°.
  function drawDoor(wall, o) {
    const sign = o.type === 'entrance' && wall.b === null ? -1 : 1;
    const hx = px(o.x);
    const hy = py(o.y);
    const r = o.width * scale;
    ctx.beginPath();
    if (wall.dir === 'h') {
      ctx.moveTo(hx, hy);
      ctx.lineTo(hx, hy + sign * r);
    } else {
      ctx.moveTo(hx, hy);
      ctx.lineTo(hx + sign * r, hy);
    }
    ctx.strokeStyle = INK;
    ctx.lineWidth = minimap ? 1 : 1.6;
    ctx.stroke();
    if (minimap) return;

    ctx.beginPath();
    if (sign > 0) ctx.arc(hx, hy, r, 0, Math.PI / 2);
    else if (wall.dir === 'h') ctx.arc(hx, hy, r, -Math.PI / 2, 0);
    else ctx.arc(hx, hy, r, Math.PI / 2, Math.PI);
    ctx.strokeStyle = GOLD;
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  function drawWindow(wall, from, to) {
    const t2 = (wall.t * scale) / 2;
    const horizontal = wall.dir === 'h';
    const a = horizontal ? px(from) : py(from);
    const b = horizontal ? px(to) : py(to);
    const c = horizontal ? py(wall.y) : px(wall.x);
    const rect = (lo, hi, fn) => (horizontal ? fn(a, c + lo, b - a, hi - lo) : fn(c + lo, a, hi - lo, b - a));
    ctx.fillStyle = PAPER;
    rect(-t2, t2, (...args) => ctx.fillRect(...args));
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1;
    rect(-t2, t2, (...args) => ctx.strokeRect(...args));
    // Двойная тонкая линия остекления.
    const gap = Math.max(1.5, t2 / 3);
    ctx.beginPath();
    for (const off of [-gap, gap]) {
      if (horizontal) {
        ctx.moveTo(a, c + off);
        ctx.lineTo(b, c + off);
      } else {
        ctx.moveTo(c + off, a);
        ctx.lineTo(c + off, b);
      }
    }
    ctx.stroke();
  }

  function drawWalls() {
    ctx.fillStyle = INK;
    for (const p of posts) ctx.fillRect(px(p.x0), py(p.y0), (p.x1 - p.x0) * scale, (p.y1 - p.y0) * scale);
    for (const wall of walls) {
      const t2 = wall.t / 2;
      for (const { from, to, opening } of splitWall(wall, plan.openings)) {
        if (!opening) {
          ctx.fillStyle = INK;
          if (wall.dir === 'h') ctx.fillRect(px(from), py(wall.y - t2), (to - from) * scale, wall.t * scale);
          else ctx.fillRect(px(wall.x - t2), py(from), wall.t * scale, (to - from) * scale);
        } else if (opening.type === 'window') {
          drawWindow(wall, from, to);
        } else {
          drawDoor(wall, opening);
        }
      }
    }
  }

  // Предмет мебели сверху: детали каталога от нижних к верхним.
  function drawItem(item, alpha = 1) {
    const def = CATALOG[item.type];
    if (!def) return;
    ctx.save();
    ctx.translate(px(item.x), py(item.y));
    ctx.rotate((item.rot * Math.PI) / 180);
    ctx.scale(scale, scale);
    ctx.translate(-def.w / 2, -def.d / 2);
    ctx.globalAlpha = alpha;
    if (minimap) {
      ctx.fillStyle = 'rgba(236, 231, 220, .26)';
      if (!def.flat) ctx.fillRect(0, 0, def.w, def.d);
      ctx.restore();
      return;
    }
    ctx.lineWidth = 0.8 / scale;
    ctx.strokeStyle = 'rgba(28, 29, 33, .42)';
    for (const p of def.top) {
      const mat = MATERIALS[p.mat];
      ctx.fillStyle = mat.flatColor || mat.color;
      ctx.globalAlpha = alpha * (mat.opacity ? 0.5 : 1);
      ctx.beginPath();
      if (p.shape === 'box') ctx.rect(p.x, p.y, p.sx, p.sy);
      else ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    if (def.flat) {
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = GOLD;
      ctx.strokeRect(10, 10, def.w - 20, def.d - 20);
    }
    ctx.restore();
  }

  function outline(item, color, dash) {
    const fp = footprint(item);
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.setLineDash(dash);
    ctx.strokeRect(px(fp.x0) - 2, py(fp.y0) - 2, (fp.x1 - fp.x0) * scale + 4, (fp.y1 - fp.y0) * scale + 4);
    ctx.restore();
  }

  function drawFurniture() {
    // Ковры — под остальной мебелью.
    const flat = (i) => Boolean(CATALOG[i.type]?.flat);
    for (const item of furniture) if (flat(item)) drawItem(item);
    for (const item of furniture) if (!flat(item)) drawItem(item);
    const chosen = selected && furniture.find((i) => i.id === selected);
    if (chosen) outline(chosen, GOLD, [5, 4]);
  }

  function drawGhost() {
    if (!ghost || !CATALOG[ghost.item.type]) return;
    drawItem(ghost.item, 0.8);
    outline(ghost.item, ghost.ok ? '#7FA38A' : '#A4553F', []);
  }

  // Подпись с подложкой — чтобы читалась поверх мебели.
  function label(text, x, y) {
    if (furniture.length) {
      ctx.save();
      ctx.strokeStyle = 'rgba(17, 18, 20, .8)';
      ctx.lineWidth = 4;
      ctx.lineJoin = 'round';
      ctx.strokeText(text, x, y);
      ctx.restore();
    }
    ctx.fillText(text, x, y);
  }

  function drawLabels() {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const r of plan.rooms) {
      const cx = px(r.x + r.w / 2);
      const cy = py(r.y + r.l / 2);
      const maxW = r.w * scale - 16;
      const name = t(`room.${r.type}`);
      const area = `${formatArea(roomArea(r))} ${t('unit.m2')}`;
      let size = 13;
      ctx.font = `600 ${size}px ${FONT}`;
      while (size > 9 && ctx.measureText(name).width > maxW) {
        size--;
        ctx.font = `600 ${size}px ${FONT}`;
      }
      const fitsName = ctx.measureText(name).width <= maxW;
      ctx.fillStyle = INK;
      if (fitsName) label(name, cx, cy - size * 0.65);
      ctx.font = `500 ${Math.max(10, size - 1)}px ${FONT}`;
      ctx.fillStyle = MUTED;
      if (ctx.measureText(area).width <= maxW) label(area, cx, fitsName ? cy + size * 0.75 : cy);
    }
  }

  // Размерная цепочка вдоль стороны: points — координаты (см) точек разбиения.
  function drawDimension(points, side) {
    const off = 26;
    const horizontal = side === 'top' || side === 'bottom';
    const base = { top: py(0) - off, bottom: py(plan.length) + off, left: px(0) - off, right: px(plan.width) + off }[side];
    const toPx = horizontal ? px : py;
    const first = toPx(points[0]);
    const last = toPx(points[points.length - 1]);

    ctx.strokeStyle = GOLD;
    ctx.fillStyle = GOLD;
    ctx.lineWidth = 1;
    ctx.beginPath();
    if (horizontal) {
      ctx.moveTo(first, base + 0.5);
      ctx.lineTo(last, base + 0.5);
    } else {
      ctx.moveTo(base + 0.5, first);
      ctx.lineTo(base + 0.5, last);
    }
    for (const p of points) {
      const v = Math.round(toPx(p)) + 0.5;
      if (horizontal) {
        ctx.moveTo(v, base - 4);
        ctx.lineTo(v, base + 5);
      } else {
        ctx.moveTo(base - 4, v);
        ctx.lineTo(base + 5, v);
      }
    }
    ctx.stroke();

    ctx.font = `500 10px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const outward = side === 'top' || side === 'left' ? -8 : 9;
    for (let i = 0; i < points.length - 1; i++) {
      const text = String(points[i + 1] - points[i]);
      const mid = (toPx(points[i]) + toPx(points[i + 1])) / 2;
      if (ctx.measureText(text).width + 6 > Math.abs(toPx(points[i + 1]) - toPx(points[i]))) continue;
      if (horizontal) {
        ctx.fillText(text, mid, base + outward);
      } else {
        ctx.save();
        ctx.translate(base + outward, mid);
        ctx.rotate(-Math.PI / 2);
        ctx.fillText(text, 0, 0);
        ctx.restore();
      }
    }
  }

  function drawDimensions() {
    const uniq = (list) => [...new Set(list)].sort((p, q) => p - q);
    const top = plan.rooms.filter((r) => r.y === 0);
    const left = plan.rooms.filter((r) => r.x === 0);
    drawDimension(uniq(top.flatMap((r) => [r.x, r.x + r.w])), 'top');
    drawDimension(uniq(left.flatMap((r) => [r.y, r.y + r.l])), 'left');
    drawDimension([0, plan.width], 'bottom');
    drawDimension([0, plan.length], 'right');
  }

  function drawPlayer() {
    const x = px(player.x);
    const y = py(player.y);
    const r = Math.max(4, PLAYER_R * scale);
    // Сектор взгляда и стрелка направления.
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.arc(x, y, r * 4.5, player.angle - 0.5, player.angle + 0.5);
    ctx.closePath();
    ctx.fillStyle = 'rgba(184, 149, 90, .28)';
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x + Math.cos(player.angle) * r * 2.4, y + Math.sin(player.angle) * r * 2.4);
    ctx.lineTo(x + Math.cos(player.angle + 2.2) * r * 1.1, y + Math.sin(player.angle + 2.2) * r * 1.1);
    ctx.lineTo(x + Math.cos(player.angle - 2.2) * r * 1.1, y + Math.sin(player.angle - 2.2) * r * 1.1);
    ctx.closePath();
    ctx.fillStyle = GOLD;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = INK;
    ctx.fill();
    ctx.strokeStyle = PAPER;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  function draw() {
    layout();
    ctx.clearRect(0, 0, w, h);
    if (!plan) return;
    drawRooms();
    drawFurniture();
    drawWalls();
    if (!minimap) {
      drawLabels();
      drawDimensions();
    }
    drawGhost();
    if (player) drawPlayer();
  }

  function onMove(e) {
    if (!plan || furnishMode || e.pointerType === 'touch') return;
    const box = canvas.getBoundingClientRect();
    const room = roomAt(plan, (e.clientX - box.left - ox) / scale, (e.clientY - box.top - oy) / scale);
    if ((room?.id ?? null) !== hover) {
      hover = room?.id ?? null;
      canvas.style.cursor = room ? 'crosshair' : '';
      draw();
    }
    if (!tooltip) return;
    tooltip.hidden = !room;
    if (!room) return;
    tooltip.innerHTML = `
      <strong>${t(`room.${room.type}`)}</strong>
      <div>${t('plan.size', { w: room.w, l: room.l })}</div>
      <div class="tt-gold">${formatArea(roomArea(room))} ${t('unit.m2')}</div>`;
    const tip = tooltip.getBoundingClientRect();
    tooltip.style.left = `${Math.max(8, Math.min(e.clientX + 16, window.innerWidth - tip.width - 8))}px`;
    tooltip.style.top = `${Math.max(8, e.clientY + 18 + tip.height > window.innerHeight ? e.clientY - tip.height - 12 : e.clientY + 18)}px`;
  }

  function onLeave() {
    hover = null;
    if (tooltip) tooltip.hidden = true;
    draw();
  }

  const observer = new ResizeObserver(draw);
  observer.observe(canvas);
  if (!minimap) {
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerleave', onLeave);
  }
  document.fonts?.ready.then(draw);

  return {
    setPlan(next) {
      plan = next;
      walls = plan ? buildWalls(plan) : [];
      posts = plan ? wallPosts(plan, walls) : [];
      hover = null;
      player = null;
      furniture = [];
      ghost = null;
      selected = null;
      if (tooltip) tooltip.hidden = true;
      draw();
    },
    // { x, y } в см, angle — направление взгляда в радианах (0 — вдоль +X).
    setPlayer(next) {
      player = next;
      draw();
    },
    setFurniture(items) {
      furniture = items;
      draw();
    },
    setGhost(next) {
      ghost = next;
      draw();
    },
    setSelected(id) {
      selected = id;
      draw();
    },
    // В режиме обстановки подсказки по комнатам отключены.
    setFurnishMode(on) {
      furnishMode = on;
      if (on) onLeave();
    },
    // Точка экрана → координаты плана в см.
    toPlan(clientX, clientY) {
      const box = canvas.getBoundingClientRect();
      return { x: (clientX - box.left - ox) / scale, y: (clientY - box.top - oy) / scale };
    },
    draw,
    destroy() {
      observer.disconnect();
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerleave', onLeave);
    },
  };
}
