#!/usr/bin/env bash
set -e
OUT_ZIP="hex-a-guys-yandex.zip"
rm -f "$OUT_ZIP"
zip -r -9 "$OUT_ZIP" index.html style.css game.js controls/ characters/ music/ presentation/ vendor/ assets/ big-fans/ roll-out/ slime-climb/ jump-showdown/ -x "*.DS_Store" "*.test.mjs" "characters/tools/*"
echo "✅ Архив для Яндекс Игр успешно собран: $OUT_ZIP"
ls -lh "$OUT_ZIP"

