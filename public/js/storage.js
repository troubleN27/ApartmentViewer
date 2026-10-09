// Обёртка над localStorage: префикс nd:, JSON, всё в try/catch.
const PREFIX = 'nd:';
const VERSION = 1;

function ls() {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function get(key, fallback = null) {
  try {
    const raw = ls().getItem(PREFIX + key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function set(key, value) {
  try {
    ls().setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    /* хранилище недоступно — работаем без него */
  }
}

export function remove(key) {
  try {
    ls().removeItem(PREFIX + key);
  } catch {
    /* noop */
  }
}

export function reset() {
  try {
    const store = ls();
    const keys = [];
    for (let i = 0; i < store.length; i++) {
      const k = store.key(i);
      if (k.startsWith(PREFIX)) keys.push(k);
    }
    keys.forEach((k) => store.removeItem(k));
  } catch {
    /* noop */
  }
}

// При смене версии формата старые данные сбрасываются.
export function init() {
  if (get('version') !== VERSION) {
    reset();
    set('version', VERSION);
  }
}
