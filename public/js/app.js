// Экраны (шахматка → планировка → 3D) и общее состояние.
import * as storage from './storage.js';
import { initLang, getLang, setLang, applyI18n } from './i18n.js';

function initLangSwitch() {
  const buttons = document.querySelectorAll('[data-lang]');
  const mark = () => buttons.forEach((b) => b.classList.toggle('is-active', b.dataset.lang === getLang()));
  buttons.forEach((b) =>
    b.addEventListener('click', () => {
      setLang(b.dataset.lang);
      mark();
    }),
  );
  mark();
}

storage.init();
initLang();
applyI18n();
initLangSwitch();
