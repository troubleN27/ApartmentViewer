// Перезаписывает data/apartments.json: дом из 9 этажей по 6 квартир.
// Планировка общая для стояка, цена растёт с этажом, статусы случайные.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomApartment, mulberry32 } from '../public/js/generator.js';

const FLOORS = 9;
const PER_FLOOR = 6;
const ROOMS_BY_STACK = [2, 1, 3, 3, 1, 2];

const file = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'data', 'apartments.json');
const rng = mulberry32(Number(process.argv[2]) || 2026);

const stacks = ROOMS_BY_STACK.map((rooms, i) => {
  const { plan } = randomApartment(Math.floor(rng() * 1e6) + 1, { rooms });
  return { plan, rooms, base: 8500000 + Math.floor(rng() * 40) * 100000 + i * 50000 };
});

const apartments = [];
for (let floor = 1; floor <= FLOORS; floor++) {
  for (let number = 1; number <= PER_FLOOR; number++) {
    const stack = stacks[number - 1];
    const roll = rng();
    apartments.push({
      id: `A-${floor}-${String(number).padStart(2, '0')}`,
      floor,
      number,
      rooms: stack.rooms,
      pricePerM2: stack.base + (floor - 1) * 150000,
      status: roll < 0.6 ? 'free' : roll < 0.8 ? 'reserved' : 'sold',
      plan: structuredClone(stack.plan),
    });
  }
}

fs.writeFileSync(file, JSON.stringify(apartments, null, 2) + '\n');
console.log(`Записано квартир: ${apartments.length} → ${path.relative(process.cwd(), file)}`);
