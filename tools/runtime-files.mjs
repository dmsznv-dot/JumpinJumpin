// Печатает список файлов, которые реально грузятся в рантайме, начиная с index.html:
// граф import (с учётом importmap), <script src>/<link href>, строки "./assets/...",
// url() в CSS и внешние uri внутри .glb. Код возврата 1, если что-то не найдено.
import fs from 'node:fs';
import path from 'node:path';

const seen = new Set();
const errors = [];
const html = fs.readFileSync('index.html', 'utf8');
const mapSrc = html.match(/<script type="importmap">([\s\S]*?)<\/script>/);
const importMap = mapSrc ? JSON.parse(mapSrc[1]).imports : {};
const external = (s) => /^(https?:|data:|blob:|#|mailto:)/.test(s);

function add(file, from) {
  file = path.normalize(file);
  if (seen.has(file)) return false;
  if (!fs.existsSync(file)) { errors.push(`нет файла ${file} (ссылка из ${from})`); return false; }
  seen.add(file);
  return true;
}

// Пути вида './assets/...' в JS считаются от index.html (так их грузит GLTFLoader/fetch).
function scanAssets(src, from) {
  src = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, ''); // без комментариев
  for (const [, p] of src.matchAll(/['"`]\.?\/?(assets\/[^'"`?#]+)['"`]/g)) visitAsset(p, from);
}

function visitAsset(file, from) {
  if (!add(file, from)) return;
  if (file.endsWith('.glb')) {
    const b = fs.readFileSync(file);
    const json = JSON.parse(b.subarray(20, 20 + b.readUInt32LE(12)).toString());
    for (const r of [...(json.images || []), ...(json.buffers || [])]) {
      if (r.uri && !external(r.uri)) visitAsset(path.join(path.dirname(file), decodeURI(r.uri)), file);
    }
  }
  if (file.endsWith('.css')) {
    const css = fs.readFileSync(file, 'utf8');
    for (const [, u] of css.matchAll(/url\(\s*['"]?([^'")]+)['"]?\s*\)/g)) {
      if (!external(u)) visitAsset(path.join(path.dirname(file), u), file);
    }
  }
}

function visitModule(file, from) {
  if (!add(file, from)) return;
  const src = fs.readFileSync(file, 'utf8');
  const specs = [
    ...src.matchAll(/\b(?:import|export)\s+(?:[^'"]*?\sfrom\s*)?['"]([^'"]+)['"]/g),
    ...src.matchAll(/\bimport\(\s*['"]([^'"]+)['"]\s*\)/g),
  ].map((m) => m[1]);
  for (const spec of specs) {
    if (external(spec) || spec.startsWith('node:')) continue;
    const target = importMap[spec] ?? (spec.startsWith('.') ? path.join(path.dirname(file), spec) : null);
    if (!target) { errors.push(`не резолвится импорт "${spec}" в ${file}`); continue; }
    visitModule(target, file);
  }
  scanAssets(src, file);
}

add('index.html', 'root');
for (const file of ['assets/headwear/LICENSE.md','characters/PRINT-LICENSE.md']) add(file,'asset attribution');
for (const [, tag, url] of html.matchAll(/<(script|link)\b[^>]*?\b(?:src|href)="([^"]+)"/g)) {
  if (external(url)) continue;
  if (tag === 'script') visitModule(url, 'index.html'); else visitAsset(url, 'index.html');
}
for (const [, s] of html.matchAll(/<script type="module">([\s\S]*?)<\/script>/g)) {
  for (const [, spec] of s.matchAll(/from\s*['"]([^'"]+)['"]/g)) visitModule(importMap[spec] ?? spec, 'index.html inline');
}
scanAssets(html, 'index.html');

if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
console.log([...seen].sort().join('\n'));
