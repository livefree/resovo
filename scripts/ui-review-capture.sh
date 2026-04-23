#!/usr/bin/env bash
# ui-review-capture.sh — HANDOFF-V2 视觉复核截图脚本
# 用法: bash scripts/ui-review-capture.sh <卡号> <route1> [route2 ...]
# 例:   bash scripts/ui-review-capture.sh HANDOFF-05 / /search
#
# 输出目录: .review-captures/<卡号>/
# 截图命名: <卡号>-<route-slug>-<theme>-<viewport>.png
# 四象限: light×desktop / light×mobile / dark×desktop / dark×mobile
set -euo pipefail

CARD="${1:?用法: $0 <卡号> <route1> [route2 ...]}"
shift
ROUTES=("$@")

if [ "${#ROUTES[@]}" -eq 0 ]; then
  echo "错误: 至少需要一个路由参数" >&2
  exit 1
fi

BASE_URL="${UI_REVIEW_BASE_URL:-http://localhost:3000}"
OUT_DIR=".review-captures/${CARD}"
mkdir -p "$OUT_DIR"

DESKTOP_W=1440
DESKTOP_H=900
MOBILE_W=390
MOBILE_H=844

slugify() {
  echo "$1" | sed 's|^/||' | sed 's|/|-|g' | sed 's|[^a-zA-Z0-9_-]|-|g' | sed 's|^$|home|'
}

capture() {
  local url="$1"
  local out_path="$2"
  local width="$3"
  local height="$4"
  local theme="$5"

  npx playwright screenshot \
    --browser chromium \
    --viewport-size "${width},${height}" \
    --full-page \
    --wait-for-selector "main, [data-testid='page-ready']" \
    --timeout 15000 \
    "${url}?_theme=${theme}" \
    "$out_path" 2>/dev/null \
  || npx playwright screenshot \
    --browser chromium \
    --viewport-size "${width},${height}" \
    --full-page \
    --timeout 15000 \
    "${url}" \
    "$out_path"
}

echo "[ui-review-capture] 卡号: ${CARD}"
echo "[ui-review-capture] 路由: ${ROUTES[*]}"
echo "[ui-review-capture] 输出: ${OUT_DIR}/"
echo ""

CAPTURED=()

for route in "${ROUTES[@]}"; do
  slug=$(slugify "$route")
  url="${BASE_URL}${route}"

  for theme in light dark; do
    # desktop
    out_desktop="${OUT_DIR}/${CARD}-${slug}-${theme}-desktop.png"
    echo -n "  截图 ${theme}×desktop ${route} ... "
    if capture "$url" "$out_desktop" "$DESKTOP_W" "$DESKTOP_H" "$theme"; then
      echo "✅ ${out_desktop}"
      CAPTURED+=("$out_desktop")
    else
      echo "⚠️  失败（fallback 手动截图）"
    fi

    # mobile
    out_mobile="${OUT_DIR}/${CARD}-${slug}-${theme}-mobile.png"
    echo -n "  截图 ${theme}×mobile  ${route} ... "
    if capture "$url" "$out_mobile" "$MOBILE_W" "$MOBILE_H" "$theme"; then
      echo "✅ ${out_mobile}"
      CAPTURED+=("$out_mobile")
    else
      echo "⚠️  失败（fallback 手动截图）"
    fi
  done
done

echo ""
echo "[ui-review-capture] 完成。自动截图 ${#CAPTURED[@]} 张。"
echo ""
echo "── 复核包路径清单 ───────────────────────────────────"
for f in "${CAPTURED[@]}"; do
  echo "  ${f}"
done
echo "──────────────────────────────────────────────────────"
echo ""
echo "⚠️  以下状态需手动截图补充（Hover / Focus / 动效瞬态）："
echo "   请在浏览器中手动操作，截图保存到 ${OUT_DIR}/ 并命名"
echo "   格式: ${CARD}-<slug>-<描述>-manual.png"
