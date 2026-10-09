// Общие помощники для процедурных текстур (рисуются на canvas).

// Детерминированный генератор для рисунка текстур.
export function seeded(seed) {
  return () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
}

// Мелкое зерно: светлые и тёмные точки.
export function grain(ctx, n, count, alpha, rnd = seeded(7)) {
  for (let i = 0; i < count; i++) {
    ctx.fillStyle = `rgba(${rnd() < 0.5 ? '0,0,0' : '255,255,255'},${rnd() * alpha})`;
    ctx.fillRect(rnd() * n, rnd() * n, 1 + rnd() * 2, 1 + rnd() * 2);
  }
}

// Крупные мягкие пятна — неоднородность тона.
export function blotches(ctx, n, count, alpha, rnd = seeded(11)) {
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

// Canvas заданного размера, раскрашенный функцией paint(ctx, size).
export function paintCanvas(size, paint) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  paint(canvas.getContext('2d'), size);
  return canvas;
}
