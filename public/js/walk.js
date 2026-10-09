// Прогулка от первого лица: PointerLockControls, WASD/стрелки, Shift, коллизии из model.js.
import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { buildColliders, collide, startPosition, PLAYER_R } from './model.js';

export const WALK_SPEED = 140; // см/с
export const RUN_SPEED = 250;

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

export function createWalk({ camera, domElement, plan, eyeHeight, onMove, onLock, onExit }) {
  const controls = new PointerLockControls(camera, domElement);
  const colliders = buildColliders(plan);
  const pressed = new Set();
  const dir = new THREE.Vector3();
  const start = startPosition(plan);
  let pos = { x: start.x, y: start.y };
  let active = false;
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
      if ((f || s) && len > 1e-4) {
        const fx = dir.x / len;
        const fy = dir.z / len;
        // Вправо от взгляда: (-fy, fx).
        let mx = fx * f - fy * s;
        let my = fy * f + fx * s;
        const norm = Math.hypot(mx, my);
        const step = (pressed.has('run') ? RUN_SPEED : WALK_SPEED) * Math.min(dt, 0.05);
        mx = (mx / norm) * step;
        my = (my / norm) * step;
        const next = collide({ x: pos.x + mx, y: pos.y + my }, colliders);
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

    getPosition: () => ({ ...pos }),
    isLocked: () => controls.isLocked,
  };
}
