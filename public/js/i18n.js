// Словари RU/UZ и функция t(key). Весь текст интерфейса живёт здесь.
import * as storage from './storage.js';

const dict = {
  ru: {
    'meta.title': 'Новый дом — квартиры бизнес-класса',
    'meta.description': 'Квартиры бизнес-класса в ЖК «Новый дом»: шахматка с ценами, планировки с площадями комнат и 3D-прогулка по квартире.',
    brand: 'Новый дом',
    'nav.apartments': 'Квартиры',
    'lang.label': 'Язык',
    'unit.sum': 'сум',
    'unit.m2': 'м²',
    'unit.cm': 'см',
    'unit.perM2': 'сум за м²',

    'hero.eyebrow': 'Жилой комплекс бизнес-класса · Ташкент',
    'hero.title': 'Новый дом',
    'hero.slogan': 'Тихий двор, продуманные планировки и свет в каждой комнате. Выберите квартиру и пройдитесь по ней ещё до переезда.',
    'hero.cta': 'Выбрать квартиру',
    'hero.floors': 'этажей',
    'hero.apartments': 'квартиры',
    'hero.deadline': 'срок сдачи',
    'hero.deadlineValue': 'IV кв. 2027',

    'about.eyebrow': 'О комплексе',
    'about.title': 'Дом, в который хочется войти',
    'about.text': 'Девять этажей, 54 квартиры и ни одной случайной планировки: у каждой свои пропорции, свет и характер.',
    'about.f1.title': 'Свет в каждой комнате',
    'about.f1.text': 'Окна есть в гостиной, в каждой спальне и на кухне.',
    'about.f2.title': 'Высокие потолки',
    'about.f2.text': 'От 2,7 до 3 метров — воздух и простор.',
    'about.f3.title': 'Примерьте до покупки',
    'about.f3.text': 'Планировка в 2D, прогулка в 3D и своя расстановка мебели.',
    'about.caption': 'Интерьер квартиры',
    'gallery.eyebrow': 'Интерьеры',
    'gallery.title': 'Как это может выглядеть',
    'gallery.hint': 'Фотографии показаны для примера. Свою обстановку можно собрать в планировке или прямо в 3D.',

    'chess.eyebrow': 'Шахматка',
    'chess.title': 'Выберите квартиру',
    'chess.hint': 'Цвет ячейки показывает статус, цены указаны в сумах. Нажмите на квартиру, чтобы открыть планировку.',
    'chess.floor': 'этаж',
    'chess.loading': 'Загружаем квартиры…',
    'chess.error': 'Не удалось загрузить квартиры. Обновите страницу.',
    'chess.noMatch': 'Под выбранные фильтры квартир нет.',
    'chess.found': 'Подходит квартир: {n}',

    'filter.rooms': 'Комнат',
    'filter.price': 'Цена',
    'filter.all': 'Все',
    'filter.any': 'Любая',
    'filter.low': 'до 500 млн',
    'filter.mid': '500–700 млн',
    'filter.high': 'от 700 млн',
    'filter.fav': 'Избранное',

    'status.free': 'Свободна',
    'status.reserved': 'Бронь',
    'status.sold': 'Продана',

    'rooms.short': '{n}-комн.',
    'rooms.full': '{n}-комнатная квартира',

    'room.living': 'Гостиная',
    'room.bedroom': 'Спальня',
    'room.kitchen': 'Кухня',
    'room.bathroom': 'Санузел',
    'room.hall': 'Прихожая',

    'fav.add': 'Добавить в избранное',
    'fav.remove': 'Убрать из избранного',

    'plan.back': 'К шахматке',
    'plan.apartment': 'Квартира № {n}',
    'plan.floor': '{n} этаж',
    'plan.area': 'Площадь',
    'plan.price': 'Стоимость',
    'plan.pricePerM2': 'Цена за м²',
    'plan.status': 'Статус',
    'plan.ceiling': 'Высота потолков',
    'plan.rooms': 'Помещения',
    'plan.view3d': 'Смотреть в 3D',
    'plan.lead': 'Записаться на просмотр',
    'plan.sold': 'Квартира продана — запись на просмотр недоступна.',
    'plan.devNote': 'Тестовая квартира (seed {n}) — заявка недоступна.',
    'plan.loading': 'Загружаем планировку…',
    'plan.notFound': 'Квартира не найдена.',
    'plan.invalid': 'Планировку нельзя показать — в данных ошибка:',
    'plan.size': '{w} × {l} см',

    'err.BAD_FORMAT': 'Некорректный формат данных плана.',
    'err.OUT_OF_BOUNDS': 'Комната выходит за контур квартиры.',
    'err.OVERLAP': 'Комнаты пересекаются.',
    'err.NOT_COVERED': 'Комнаты не покрывают квартиру целиком.',
    'err.OPENING_NOT_ON_WALL': 'Проём не лежит на стене.',
    'err.OPENING_OVERLAP': 'Проёмы на одной стене пересекаются.',
    'err.DOOR_WIDTH': 'Недопустимая ширина двери.',
    'err.DOOR_NOT_INNER': 'Дверь должна стоять на внутренней стене.',
    'err.ENTRANCE_COUNT': 'У квартиры должна быть ровно одна входная дверь.',
    'err.ENTRANCE_WIDTH': 'Ширина входной двери должна быть 90 см.',
    'err.ENTRANCE_NOT_OUTER': 'Входная дверь должна стоять на внешней стене.',
    'err.WINDOW_WIDTH': 'Недопустимая ширина окна.',
    'err.WINDOW_NOT_OUTER': 'Окно должно стоять на внешней стене.',
    'err.NO_WINDOW': 'В жилой комнате или кухне нет окна.',
    'err.UNREACHABLE': 'В одну из комнат нельзя попасть от входной двери.',

    'v3d.close': 'Закрыть 3D',
    'v3d.orbit': 'Облёт',
    'v3d.walk': 'Прогулка',
    'v3d.whitebox': 'Whitebox',
    'v3d.finish': 'Чистовая',
    'v3d.fullscreen': 'Полный экран',
    'v3d.hintOrbit': 'Зажмите мышь, чтобы вращать · колесо — масштаб · Esc — выход',
    'v3d.hintWalk': 'WASD / стрелки — идти · мышь — осмотреться · Shift — быстрее · Esc — выйти',
    'v3d.clickToLook': 'Нажмите на сцену, чтобы осматриваться мышью',
    'v3d.minimap': 'Мини-карта',
    'v3d.eye': 'Глаза на высоте {n} см',

    'height.title': 'Ваш рост',
    'height.text': 'Мы поставим камеру на высоту ваших глаз, чтобы квартира ощущалась в настоящем масштабе.',
    'height.label': 'Рост, см',
    'height.error': 'Укажите рост от 120 до 220 см.',
    'height.start': 'Начать прогулку',
    'common.cancel': 'Отмена',
    'common.close': 'Закрыть',

    'lead.title': 'Запись на просмотр',
    'lead.text': 'Оставьте контакты — менеджер перезвонит и согласует время.',
    'lead.name': 'Имя',
    'lead.phone': 'Телефон',
    'lead.phoneHint': 'Формат: +998XXXXXXXXX',
    'lead.submit': 'Отправить заявку',
    'lead.sending': 'Отправляем…',
    'lead.successTitle': 'Заявка принята',
    'lead.successText': 'Спасибо, {name}! Мы свяжемся с вами по номеру {phone}.',
    'lead.err.name': 'Имя — от 2 до 60 символов.',
    'lead.err.phone': 'Телефон в формате +998XXXXXXXXX.',
    'lead.err.apartment': 'Квартира не найдена.',
    'lead.err.sold': 'Эта квартира уже продана.',
    'lead.err.network': 'Не удалось отправить заявку. Попробуйте ещё раз.',

    'dev.title': 'Dev-панель',
    'dev.seed': 'Seed',
    'dev.random': 'Случайная квартира',
    'dev.reset': 'Сбросить localStorage',
    'dev.failed': 'Не удалось сгенерировать квартиру.',

    'furn.edit': 'Обустроить',
    'furn.done': 'Готово',
    'furn.random': 'Обставить случайно',
    'furn.clear': 'Убрать всё',
    'furn.rotate': 'Повернуть',
    'furn.delete': 'Удалить',
    'furn.count': 'Предметов: {n}',
    'furn.hint': 'Выберите предмет в каталоге и поставьте его на план. Перетаскивайте мышью, R — повернуть, Delete — удалить.',
    'furn.hintPlace': 'Кликните в комнате, чтобы поставить. R — повернуть, Esc — отмена.',
    'furn.hint3d': 'Выберите предмет и кликните на полу комнаты. Тяните предметы мышью, за свободное место — вращайте камеру. R — повернуть, Delete — удалить.',
    'furn.err.type': 'Этот предмет поставить нельзя.',
    'furn.err.bounds': 'Предмет не помещается в комнате.',
    'furn.err.overlap': 'Здесь уже стоит другой предмет.',
    'furn.err.door': 'Нельзя загораживать дверь.',
    'furn.err.passage': 'Предмет перекрывает проход между дверями.',
    'furn.sofa': 'Диван',
    'furn.armchair': 'Кресло',
    'furn.coffeeTable': 'Журнальный столик',
    'furn.tvStand': 'Тумба с телевизором',
    'furn.bookshelf': 'Стеллаж',
    'furn.plant': 'Растение',
    'furn.floorLamp': 'Торшер',
    'furn.rug': 'Ковёр',
    'furn.bedDouble': 'Двуспальная кровать',
    'furn.bedSingle': 'Односпальная кровать',
    'furn.nightstand': 'Прикроватная тумба',
    'furn.wardrobe': 'Шкаф',
    'furn.desk': 'Письменный стол',
    'furn.chair': 'Стул',
    'furn.dresser': 'Комод',
    'furn.counter': 'Кухонная тумба',
    'furn.sinkUnit': 'Мойка',
    'furn.stove': 'Плита',
    'furn.fridge': 'Холодильник',
    'furn.diningTable': 'Обеденный стол',
    'furn.toilet': 'Унитаз',
    'furn.bathtub': 'Ванна',
    'furn.shower': 'Душевая кабина',
    'furn.washbasin': 'Раковина с зеркалом',
    'furn.washingMachine': 'Стиральная машина',
    'furn.wardrobeHall': 'Шкаф с зеркалом',
    'furn.shoeCabinet': 'Обувница',
  },

  uz: {
    'meta.title': 'Yangi uy — biznes-klass xonadonlar',
    'meta.description': "«Yangi uy» TJMdagi biznes-klass xonadonlar: narxlar bilan shaxmatka, xonalar maydoni ko'rsatilgan rejalar va xonadon bo'ylab 3D sayr.",
    brand: 'Yangi uy',
    'nav.apartments': 'Xonadonlar',
    'lang.label': 'Til',
    'unit.sum': "so'm",
    'unit.m2': 'm²',
    'unit.cm': 'sm',
    'unit.perM2': "so'm / m²",

    'hero.eyebrow': 'Biznes-klass turar joy majmuasi · Toshkent',
    'hero.title': 'Yangi uy',
    'hero.slogan': "Sokin hovli, puxta o'ylangan rejalar va har bir xonada yorug'lik. Xonadonni tanlang va ko'chib o'tishdan oldin uni aylanib chiqing.",
    'hero.cta': 'Xonadon tanlash',
    'hero.floors': 'qavat',
    'hero.apartments': 'xonadon',
    'hero.deadline': 'topshirish muddati',
    'hero.deadlineValue': '2027, IV chorak',

    'about.eyebrow': 'Majmua haqida',
    'about.title': 'Kirging keladigan uy',
    'about.text': "To'qqiz qavat, 54 xonadon va birorta tasodifiy reja yo'q: har birining o'z nisbati, yorug'ligi va xarakteri bor.",
    'about.f1.title': "Har bir xonada yorug'lik",
    'about.f1.text': 'Mehmonxona, har bir yotoqxona va oshxonada deraza bor.',
    'about.f2.title': 'Baland shiftlar',
    'about.f2.text': '2,7 dan 3 metrgacha — havo va kenglik.',
    'about.f3.title': "Sotib olishdan oldin ko'ring",
    'about.f3.text': "2D reja, 3D sayr va mebelni o'zingiz joylashtirish.",
    'about.caption': 'Xonadon interyeri',
    'gallery.eyebrow': 'Interyerlar',
    'gallery.title': "Bu qanday ko'rinishi mumkin",
    'gallery.hint': "Suratlar namuna sifatida ko'rsatilgan. O'z jihozlash variantingizni rejada yoki bevosita 3D da yig'ishingiz mumkin.",

    'chess.eyebrow': 'Shaxmatka',
    'chess.title': 'Xonadonni tanlang',
    'chess.hint': "Katak rangi holatni bildiradi, narxlar so'mda. Rejani ochish uchun xonadonni bosing.",
    'chess.floor': 'qavat',
    'chess.loading': 'Xonadonlar yuklanmoqda…',
    'chess.error': "Xonadonlarni yuklab bo'lmadi. Sahifani yangilang.",
    'chess.noMatch': "Tanlangan filtrlarga mos xonadon yo'q.",
    'chess.found': 'Mos xonadonlar: {n}',

    'filter.rooms': 'Xonalar',
    'filter.price': 'Narx',
    'filter.all': 'Barchasi',
    'filter.any': 'Istalgan',
    'filter.low': '500 mln gacha',
    'filter.mid': '500–700 mln',
    'filter.high': '700 mln dan',
    'filter.fav': 'Sevimlilar',

    'status.free': "Bo'sh",
    'status.reserved': 'Band',
    'status.sold': 'Sotilgan',

    'rooms.short': '{n} xonali',
    'rooms.full': '{n} xonali xonadon',

    'room.living': 'Mehmonxona',
    'room.bedroom': 'Yotoqxona',
    'room.kitchen': 'Oshxona',
    'room.bathroom': 'Hammom',
    'room.hall': 'Dahliz',

    'fav.add': "Sevimlilarga qo'shish",
    'fav.remove': 'Sevimlilardan olib tashlash',

    'plan.back': 'Shaxmatkaga',
    'plan.apartment': '{n}-xonadon',
    'plan.floor': '{n}-qavat',
    'plan.area': 'Maydon',
    'plan.price': 'Narxi',
    'plan.pricePerM2': 'm² narxi',
    'plan.status': 'Holati',
    'plan.ceiling': 'Shift balandligi',
    'plan.rooms': 'Xonalar',
    'plan.view3d': "3D da ko'rish",
    'plan.lead': "Ko'rishga yozilish",
    'plan.sold': "Xonadon sotilgan — ko'rishga yozilib bo'lmaydi.",
    'plan.devNote': "Sinov xonadoni (seed {n}) — ariza qoldirib bo'lmaydi.",
    'plan.loading': 'Reja yuklanmoqda…',
    'plan.notFound': 'Xonadon topilmadi.',
    'plan.invalid': "Rejani ko'rsatib bo'lmaydi — ma'lumotlarda xato:",
    'plan.size': '{w} × {l} sm',

    'err.BAD_FORMAT': "Reja ma'lumotlari formati noto'g'ri.",
    'err.OUT_OF_BOUNDS': 'Xona xonadon chegarasidan chiqib ketgan.',
    'err.OVERLAP': 'Xonalar bir-birini kesib o\'tadi.',
    'err.NOT_COVERED': "Xonalar xonadonni to'liq qoplamaydi.",
    'err.OPENING_NOT_ON_WALL': 'Eshik yoki deraza devorda joylashmagan.',
    'err.OPENING_OVERLAP': "Bir devordagi o'yiqlar kesishadi.",
    'err.DOOR_WIDTH': "Eshik kengligi noto'g'ri.",
    'err.DOOR_NOT_INNER': "Eshik ichki devorda bo'lishi kerak.",
    'err.ENTRANCE_COUNT': "Xonadonda aynan bitta kirish eshigi bo'lishi kerak.",
    'err.ENTRANCE_WIDTH': "Kirish eshigi kengligi 90 sm bo'lishi kerak.",
    'err.ENTRANCE_NOT_OUTER': "Kirish eshigi tashqi devorda bo'lishi kerak.",
    'err.WINDOW_WIDTH': "Deraza kengligi noto'g'ri.",
    'err.WINDOW_NOT_OUTER': "Deraza tashqi devorda bo'lishi kerak.",
    'err.NO_WINDOW': "Yashash xonasi yoki oshxonada deraza yo'q.",
    'err.UNREACHABLE': "Xonalardan biriga kirish eshigidan yetib bo'lmaydi.",

    'v3d.close': '3D ni yopish',
    'v3d.orbit': 'Aylanib ko\'rish',
    'v3d.walk': 'Sayr',
    'v3d.whitebox': 'Whitebox',
    'v3d.finish': 'Pardozli',
    'v3d.fullscreen': "To'liq ekran",
    'v3d.hintOrbit': "Aylantirish uchun sichqonchani bosib turing · g'ildirak — masshtab · Esc — chiqish",
    'v3d.hintWalk': "WASD / strelkalar — yurish · sichqoncha — atrofga qarash · Shift — tezroq · Esc — chiqish",
    'v3d.clickToLook': 'Sichqoncha bilan qarash uchun sahnani bosing',
    'v3d.minimap': 'Mini-xarita',
    'v3d.eye': "Ko'z balandligi {n} sm",

    'height.title': "Bo'yingiz",
    'height.text': "Xonadon haqiqiy o'lchamda his etilishi uchun kamerani ko'zingiz balandligiga qo'yamiz.",
    'height.label': "Bo'y, sm",
    'height.error': "Bo'yni 120 dan 220 sm gacha kiriting.",
    'height.start': 'Sayrni boshlash',
    'common.cancel': 'Bekor qilish',
    'common.close': 'Yopish',

    'lead.title': "Ko'rishga yozilish",
    'lead.text': "Kontaktlaringizni qoldiring — menejer qo'ng'iroq qilib, vaqtni kelishadi.",
    'lead.name': 'Ism',
    'lead.phone': 'Telefon',
    'lead.phoneHint': 'Format: +998XXXXXXXXX',
    'lead.submit': 'Ariza yuborish',
    'lead.sending': 'Yuborilmoqda…',
    'lead.successTitle': 'Ariza qabul qilindi',
    'lead.successText': "Rahmat, {name}! Siz bilan {phone} raqami orqali bog'lanamiz.",
    'lead.err.name': 'Ism — 2 dan 60 belgigacha.',
    'lead.err.phone': 'Telefon +998XXXXXXXXX formatida.',
    'lead.err.apartment': 'Xonadon topilmadi.',
    'lead.err.sold': 'Bu xonadon allaqachon sotilgan.',
    'lead.err.network': "Arizani yuborib bo'lmadi. Qayta urinib ko'ring.",

    'dev.title': 'Dev-panel',
    'dev.seed': 'Seed',
    'dev.random': 'Tasodifiy xonadon',
    'dev.reset': 'localStorage ni tozalash',
    'dev.failed': "Xonadonni yaratib bo'lmadi.",

    'furn.edit': 'Jihozlash',
    'furn.done': 'Tayyor',
    'furn.random': 'Tasodifiy jihozlash',
    'furn.clear': 'Hammasini olib tashlash',
    'furn.rotate': 'Burish',
    'furn.delete': "O'chirish",
    'furn.count': 'Buyumlar: {n}',
    'furn.hint': "Katalogdan buyum tanlang va rejaga qo'ying. Sichqoncha bilan suring, R — burish, Delete — o'chirish.",
    'furn.hintPlace': "Qo'yish uchun xona ichini bosing. R — burish, Esc — bekor qilish.",
    'furn.hint3d': "Buyumni tanlang va xona polini bosing. Buyumlarni sichqoncha bilan suring, bo'sh joydan ushlab kamerani aylantiring. R — burish, Delete — o'chirish.",
    'furn.err.type': "Bu buyumni qo'yib bo'lmaydi.",
    'furn.err.bounds': "Buyum xonaga sig'maydi.",
    'furn.err.overlap': 'Bu yerda boshqa buyum turibdi.',
    'furn.err.door': "Eshikni to'sib bo'lmaydi.",
    'furn.err.passage': "Buyum eshiklar orasidagi yo'lni to'sadi.",
    'furn.sofa': 'Divan',
    'furn.armchair': 'Kreslo',
    'furn.coffeeTable': 'Jurnal stoli',
    'furn.tvStand': 'Televizorli tumba',
    'furn.bookshelf': 'Kitob javoni',
    'furn.plant': "O'simlik",
    'furn.floorLamp': 'Torsher',
    'furn.rug': 'Gilam',
    'furn.bedDouble': 'Ikki kishilik karavot',
    'furn.bedSingle': 'Bir kishilik karavot',
    'furn.nightstand': 'Karavot yoni tumbasi',
    'furn.wardrobe': 'Shkaf',
    'furn.desk': 'Yozuv stoli',
    'furn.chair': 'Stul',
    'furn.dresser': 'Komod',
    'furn.counter': 'Oshxona tumbasi',
    'furn.sinkUnit': 'Moyka',
    'furn.stove': 'Plita',
    'furn.fridge': 'Muzlatgich',
    'furn.diningTable': 'Ovqat stoli',
    'furn.toilet': 'Unitaz',
    'furn.bathtub': 'Vanna',
    'furn.shower': 'Dush kabinasi',
    'furn.washbasin': 'Oynali rakovina',
    'furn.washingMachine': 'Kir yuvish mashinasi',
    'furn.wardrobeHall': 'Oynali shkaf',
    'furn.shoeCabinet': 'Poyabzal javoni',
  },
};

export const LANGS = ['ru', 'uz'];
let lang = 'ru';
const listeners = new Set();

export function initLang() {
  const saved = storage.get('lang');
  lang = LANGS.includes(saved) ? saved : 'ru';
  return lang;
}

export function getLang() {
  return lang;
}

export function setLang(next) {
  if (!LANGS.includes(next) || next === lang) return;
  lang = next;
  storage.set('lang', lang);
  applyI18n();
  listeners.forEach((fn) => fn(lang));
}

export function onLangChange(fn) {
  listeners.add(fn);
}

export function t(key, vars) {
  let s = dict[lang][key] ?? dict.ru[key] ?? key;
  if (vars) for (const k in vars) s = s.replaceAll(`{${k}}`, vars[k]);
  return s;
}

// Проставляет тексты элементам с data-i18n, data-i18n-placeholder, data-i18n-aria.
export function applyI18n(root = document) {
  document.documentElement.lang = lang;
  root.querySelectorAll('[data-i18n]').forEach((el) => {
    el.textContent = t(el.dataset.i18n);
  });
  root.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
    el.placeholder = t(el.dataset.i18nPlaceholder);
  });
  root.querySelectorAll('[data-i18n-content]').forEach((el) => {
    el.content = t(el.dataset.i18nContent);
  });
  root.querySelectorAll('[data-i18n-alt]').forEach((el) => {
    el.alt = t(el.dataset.i18nAlt);
  });
  root.querySelectorAll('[data-i18n-aria]').forEach((el) => {
    const text = t(el.dataset.i18nAria);
    el.setAttribute('aria-label', text);
    el.title = text;
  });
}
