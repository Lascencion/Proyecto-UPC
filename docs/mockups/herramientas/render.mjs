// Convierte las páginas HTML de los mockups en PNG (tamaño completo y miniatura para el .bmpr).
// Uso: node render.mjs <carpeta_html> <carpeta_png> <carpeta_miniaturas>
import { createRequire } from 'node:module';
import { readFileSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE ?? 'playwright');

const [htmlDir, pngDir, thumbDir] = process.argv.slice(2).map((p) => resolve(p));
mkdirSync(pngDir, { recursive: true });
mkdirSync(thumbDir, { recursive: true });
const index = JSON.parse(readFileSync(join(htmlDir, 'index.json'), 'utf8'));

const browser = await chromium.launch();
for (const screen of index) {
  const url = 'file://' + join(htmlDir, screen.file + '.html');
  const page = await browser.newPage({ viewport: { width: screen.width, height: screen.height }, deviceScaleFactor: 1.5 });
  await page.goto(url);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: join(pngDir, screen.file + '.png'), clip: { x: 0, y: 0, width: screen.width, height: screen.height } });
  await page.close();

  const thumb = await browser.newPage({ viewport: { width: screen.width, height: screen.height }, deviceScaleFactor: 0.2 });
  await thumb.goto(url);
  await thumb.evaluate(() => document.fonts.ready);
  await thumb.screenshot({ path: join(thumbDir, screen.file + '.png') });
  await thumb.close();
  console.log('ok', screen.name);
}
await browser.close();
