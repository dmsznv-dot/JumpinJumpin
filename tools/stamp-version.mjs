// Cache-busting без бандлера: дописывает ?v=<версия> к style.css, входному скрипту
// и через importmap — ко всем ES-модулям (относительные импорты внутри модулей
// резолвятся в URL, который совпадает с ключом importmap, и подменяются).
// Использование: node tools/stamp-version.mjs <каталог-с-index.html> <версия> <файлы...>
import fs from 'node:fs';
import path from 'node:path';

const [dir, ver, ...files] = process.argv.slice(2);
const file = path.join(dir, 'index.html');
let html = fs.readFileSync(file, 'utf8');
const q = `?v=${encodeURIComponent(ver)}`;

html = html.replace(/<script type="importmap">([\s\S]*?)<\/script>/, (_, json) => {
  const map = JSON.parse(json);
  map.imports ??= {};
  for (const [k, v] of Object.entries(map.imports)) map.imports[k] = v + q;
  for (const f of files) {
    if (!/\.(m?js)$/.test(f)) continue;
    const key = './' + f;
    if (!Object.values(map.imports).some((v) => v.startsWith(key + '?'))) map.imports[key] = key + q;
  }
  // modulepreload: браузер качает весь граф параллельно, без водопада game.js → модули → вложенные.
  const preload = [...new Set(Object.values(map.imports))]
    .filter((u) => !u.startsWith('./game.js'))
    .map((u) => `<link rel="modulepreload" href="${u}">`).join('\n  ');
  return `<script type="importmap">\n${JSON.stringify(map, null, 2)}\n</script>\n  ${preload}`;
});
html = html.replace(/(<(?:script|link)\b[^>]*?\b(?:src|href)=")(?!https?:|data:)([^"?#]+)(")/g, `$1$2${q}$3`);
fs.writeFileSync(file, html);
