// Прогулка от первого лица: PointerLockControls, WASD/стрелки, Shift, коллизии из model.js.
import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { buildColliders, collide, startPosition, PLAYER_R } from './model.js';

export const WALK_SPEED = 140; // см/с
export const RUN_SPEED = 250;
const ACCEL = 9; // чем больше, тем резче разгон и остановка

const KEYS = {
  KeyW: 'forward',
  ArrowUp: 'forward',
  KeyS: 'back',
  ArrowDown: 'back',
  KeyA: 'left',
  ArrowLeft: 'left',
  KeyD: 'right',
  ArrowRight: 'right',
  ShiftLeft: 'run',
  ShiftRight: 'run',
};

export function createWalk({ camera, domElement, plan, eyeHeight, obstacles = [], onMove, onLock, onExit }) {
  const controls = new PointerLockControls(camera, domElement);
  const walls = buildColliders(plan);
  let colliders = walls.concat(obstacles); // стены и мебель
  const pressed = new Set();
  const dir = new THREE.Vector3();
  const start = startPosition(plan);
  let pos = { x: start.x, y: start.y };
  let active = false;
  let vx = 0; // текущая скорость, см/с
  let vy = 0;
  let lastSent = '';

  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

  function place() {
    camera.position.set(pos.x / 100, eyeHeight / 100, pos.y / 100);
  }

  function emit() {
    camera.getWorldDirection(dir);
    const angle = Math.atan2(dir.z, dir.x);
    const key = `${pos.x.toFixed(1)}|${pos.y.toFixed(1)}|${angle.toFixed(2)}`;
    if (key === lastSent) return;
    lastSent = key;
    onMove?.({ x: pos.x, y: pos.y, angle });
  }

  function lock() {
    // Захват запрашиваем сами, чтобы перехватить отказ браузера; controls слушает pointerlockchange.
    try {
      domElement.requestPointerLock()?.catch?.(() => {});
    } catch {
      /* захват мыши недоступен — остаётся управление с клавиатуры */
    }
  }

  function onKeyDown(e) {
    const action = KEYS[e.code];
    if (!action || e.target.closest?.('input, textarea')) return;
    pressed.add(action);
    e.preventDefault();
  }

  function onKeyUp(e) {
    pressed.delete(KEYS[e.code]);
  }

  const onBlur = () => pressed.clear();
  const onClick = () => active && !controls.isLocked && lock();
  const onLocked = () => onLock?.(true);
  function onUnlocked() {
    onLock?.(false);
    if (active) onExit?.();
  }

  return {
    start() {
      active = true;
      place();
      camera.lookAt(camera.position.x + start.dx, eyeHeight / 100, camera.position.z + start.dy);
      window.addEventListener('keydown', onKeyDown);
      window.addEventListener('keyup', onKeyUp);
      window.addEventListener('blur', onBlur);
      domElement.addEventListener('click', onClick);
      controls.addEventListener('lock', onLocked);
      controls.addEventListener('unlock', onUnlocked);
      lock();
      emit();
    },

    update(dt) {
      if (!active) return;
      const f = (pressed.has('forward') ? 1 : 0) - (pressed.has('back') ? 1 : 0);
      const s = (pressed.has('right') ? 1 : 0) - (pressed.has('left') ? 1 : 0);
      camera.getWorldDirection(dir);
      const len = Math.hypot(dir.x, dir.z);
      dt = Math.min(dt, 0.05);
      // Целевая скорость по нажатым клавишам.
      let tx = 0;
      let ty = 0;
      if ((f || s) && len > 1e-4) {
        const fx = dir.x / len;
        const fy = dir.z / len;
        // Вправо от взгляда: (-fy, fx).
        const mx = fx * f - fy * s;
        const my = fy * f + fx * s;
        const speed = (pressed.has('run') ? RUN_SPEED : WALK_SPEED) / Math.hypot(mx, my);
        tx = mx * speed;
        ty = my * speed;
      }
      // Плавный разгон и остановка: без них шаг ощущается как скольжение.
      const k = Math.min(1, dt * ACCEL);
      vx += (tx - vx) * k;
      vy += (ty - vy) * k;
      if (Math.hypot(vx, vy) < 1) vx = vy = 0;
      if (vx || vy) {
        const next = collide({ x: pos.x + vx * dt, y: pos.y + vy * dt }, colliders);
        pos = {
          x: clamp(next.x, PLAYER_R, plan.width - PLAYER_R),
          y: clamp(next.y, PLAYER_R, plan.length - PLAYER_R),
        };
        place();
      }
      emit();
    },

    stop() {
      active = false;
      vx = vy = 0;
      pressed.clear();
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      domElement.removeEventListener('click', onClick);
      controls.removeEventListener('lock', onLocked);
      controls.removeEventListener('unlock', onUnlocked);
      if (controls.isLocked) controls.unlock();
      controls.dispose();
    },

    // Мебель переставили: обновляем препятствия и выталкиваем игрока, если он оказался внутри.
    setObstacles(list) {
      colliders = walls.concat(list);
      pos = collide(pos, colliders);
      if (active) place();
    },

    getPosition: () => ({ ...pos }),
    isLocked: () => controls.isLocked,
  };
}
