#!/usr/bin/env bash
# Архив для Яндекс Игр: только файлы, реально загружаемые в рантайме
# (список строит tools/runtime-files.mjs), содержимое берётся из HEAD.
set -euo pipefail
cd "$(dirname "$0")"

OUT_ZIP="${OUT_ZIP:-hex-a-guys-yandex.zip}"
# Яндекс Игры: все файлы игры в разархивированном виде — не больше 100 МБ
# (yandex.ru/dev/games/doc/ru/concepts/requirements). Бюджет считаем по распакованному размеру.
MAX_KB="${MAX_KB:-102400}"
SKIP_TESTS="${SKIP_TESTS:-0}"

if [ "$SKIP_TESTS" != "1" ]; then
  echo "▶ Тесты"
  # shellcheck disable=SC2046
  node --test $(git ls-files '*.test.mjs')
fi

echo "▶ Рантайм-зависимости"
FILES="$(node tools/runtime-files.mjs)"

MISSING=""
for f in $FILES; do
  git ls-files --error-unmatch "$f" >/dev/null 2>&1 || MISSING="$MISSING $f"
done
if [ -n "$MISSING" ]; then
  echo "✖ Нужны в рантайме, но не закоммичены:$MISSING"; exit 1
fi
# shellcheck disable=SC2086
git diff --quiet HEAD -- $FILES || echo "⚠ Есть незакоммиченные правки — в архив идёт версия из HEAD."

STAGE="$(mktemp -d)"
trap 'rm -rf "$STAGE"' EXIT
# shellcheck disable=SC2086
git archive HEAD $FILES | tar -x -C "$STAGE"
node tools/stamp-version.mjs "$STAGE" "$(git rev-parse --short HEAD)" $FILES

case "$OUT_ZIP" in /*) ;; *) OUT_ZIP="$PWD/$OUT_ZIP" ;; esac
rm -f "$OUT_ZIP"
(cd "$STAGE" && zip -q -r -9 -X -D "$OUT_ZIP" .)

COUNT=$(echo "$FILES" | wc -l | tr -d ' ')
SIZE_KB=$(( $(wc -c < "$OUT_ZIP") / 1024 ))
UNPACKED_KB=$(( $(unzip -l "$OUT_ZIP" | tail -1 | awk '{print $1}') / 1024 ))
echo "✅ $OUT_ZIP — $COUNT файлов, архив ${SIZE_KB} КБ, распакованно ${UNPACKED_KB} КБ, коммит $(git rev-parse --short HEAD)"
unzip -l "$OUT_ZIP" | awk 'NR>3 && $4!="" {print $1"\t"$4}' | sort -rn | head -5
[ "$UNPACKED_KB" -le "$MAX_KB" ] || { echo "✖ Распакованная игра больше бюджета ${MAX_KB} КБ"; exit 1; }
