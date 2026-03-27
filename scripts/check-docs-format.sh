#!/usr/bin/env bash
# scripts/check-docs-format.sh
# CHORE-01/Docs-Phase-C: 检查文档规范
#
# 检查项：
#   1. task-queue.md 中已填写的时间字段格式为 YYYY-MM-DD HH:mm
#   2. changelog.md 中 **时间** 字段格式为 YYYY-MM-DD
#   3. task-queue.md 中序列 ID（SEQ-YYYYMMDD-XX）按文件出现顺序单调递增（尾部追加验证）
#   4. 带元信息文档的字段完整性（status/owner/scope/source_of_truth/supersedes/superseded_by/last_reviewed）
#   5. source_of_truth: yes 文档按 sot_topic 唯一（若未提供 sot_topic，回退到文件名）
#   6. plan 文档（active/draft/completed 且 source_of_truth=no）文件名必须带 YYYYMMDD 日期后缀
#
# 用法：bash scripts/check-docs-format.sh
# 兼容：macOS（BSD grep/sed）和 Linux（GNU grep/sed）

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DOCS_DIR="$ROOT/docs"
TASK_QUEUE="$ROOT/docs/task-queue.md"
CHANGELOG="$ROOT/docs/changelog.md"

ERRORS=0
WARNINGS=0
TMP_WITHOUT_META=""
TMP_SOT=""
TMP_DUP_TOPICS=""

fail() {
  echo "❌ $1"
  ERRORS=$((ERRORS + 1))
}

ok() {
  echo "✅ $1"
}

warn() {
  echo "⚠️  $1"
  WARNINGS=$((WARNINGS + 1))
}

lower() {
  echo "$1" | tr '[:upper:]' '[:lower:]'
}

field_value() {
  # 从文档头部元信息中取值，例如：field_value file.md "status"
  local file="$1"
  local key="$2"
  sed -n '1,40p' "$file" | sed -n "s/^> ${key}:[[:space:]]*//p" | head -n 1 | tr -d '\r'
}

# ─── Check 1: task-queue.md 时间格式 ─────────────────────────────────────────
echo "=== [1] task-queue.md 时间字段格式 ==="
# 合规值：_ 或 YYYY-MM-DD HH:mm
TIME_LABEL_PATTERN='(创建时间|计划开始|实际开始|完成时间|最后更新时间)：'
# 只对以数字开头的值进行格式验证（排除空值、"_"、描述性占位符如"合并后"）
DATE_ATTEMPT_PATTERN='(创建时间|计划开始|实际开始|完成时间|最后更新时间)：[0-9]'
VALID_DATE_PATTERN='(创建时间|计划开始|实际开始|完成时间|最后更新时间)：[0-9]{4}-[0-9]{2}-[0-9]{2} [0-9]{2}:[0-9]{2}$'

INVALID_TIMES=$(grep -nE "$DATE_ATTEMPT_PATTERN" "$TASK_QUEUE" | grep -vE "$VALID_DATE_PATTERN" || true)
if [ -n "$INVALID_TIMES" ]; then
  fail "task-queue.md 存在不合规时间格式（以数字开头但非 YYYY-MM-DD HH:mm）："
  echo "$INVALID_TIMES"
else
  ok "task-queue.md 时间字段格式正常"
fi

# ─── Check 2: changelog.md 时间格式 ──────────────────────────────────────────
echo ""
echo "=== [2] changelog.md 时间字段格式 ==="
# 合规值：**时间**：YYYY-MM-DD
CL_INVALID=$(grep -nE '^\*\*时间\*\*：' "$CHANGELOG" | grep -vE '^\*\*时间\*\*：[0-9]{4}-[0-9]{2}-[0-9]{2}$' || true)
if [ -n "$CL_INVALID" ]; then
  fail "changelog.md 存在不合规时间格式："
  echo "$CL_INVALID"
else
  ok "changelog.md 时间字段格式正常"
fi

# ─── Check 3: SEQ 序列 ID 顺序（尾部追加验证）───────────────────────────────
echo ""
echo "=== [3] task-queue.md SEQ 序列 ID 顺序 ==="
# 历史上存在少量非单调记录，默认做告警不阻断；
# 如需强校验，可在执行前设置 STRICT_DOC_SEQ_ORDER=1
ORDERED_SEQ=$(grep -oE 'SEQ-[0-9]{8}-[0-9]+' "$TASK_QUEUE" | awk '!seen[$0]++' || true)
PREV_SEQ=""
INVERSIONS=0
EXAMPLES=""
while IFS= read -r seq; do
  [ -z "$seq" ] && continue
  if [ -n "$PREV_SEQ" ] && [ "$seq" \< "$PREV_SEQ" ]; then
    INVERSIONS=$((INVERSIONS + 1))
    if [ "$INVERSIONS" -le 3 ]; then
      EXAMPLES="${EXAMPLES}\n    ${PREV_SEQ} -> ${seq}"
    fi
  fi
  PREV_SEQ="$seq"
done <<EOF
$ORDERED_SEQ
EOF

if [ "$INVERSIONS" -eq 0 ]; then
  ok "SEQ 序列 ID 顺序符合尾部追加规范"
else
  if [ "${STRICT_DOC_SEQ_ORDER:-0}" = "1" ]; then
    fail "SEQ 序列 ID 顺序异常（发现 $INVERSIONS 处逆序）"
    echo -e "  逆序示例（最多 3 条）：$EXAMPLES"
  else
    warn "SEQ 序列 ID 存在 $INVERSIONS 处历史逆序（本次不阻断，建议后续清理）"
    echo -e "  逆序示例（最多 3 条）：$EXAMPLES"
  fi
fi

# ─── Check 4: docs 元信息字段完整性 ──────────────────────────────────────────
echo ""
echo "=== [4] docs 元信息字段完整性 ==="

META_FILE_COUNT=0
NO_META_COUNT=0

TMP_WITHOUT_META="$(mktemp)"
trap 'rm -f "${TMP_WITHOUT_META:-}" "${TMP_SOT:-}" "${TMP_DUP_TOPICS:-}"' EXIT

while IFS= read -r file; do
  head_block="$(sed -n '1,40p' "$file")"
  rel="${file#$ROOT/}"

  if echo "$head_block" | grep -qE '^> status:[[:space:]]*'; then
    META_FILE_COUNT=$((META_FILE_COUNT + 1))
    missing=""
    for key in status owner scope source_of_truth supersedes superseded_by last_reviewed; do
      if ! echo "$head_block" | grep -qE "^> ${key}:[[:space:]]*"; then
        if [ -z "$missing" ]; then
          missing="$key"
        else
          missing="$missing, $key"
        fi
      fi
    done

    if [ -n "$missing" ]; then
      fail "$rel 元信息缺失字段: $missing"
    fi

    reviewed="$(field_value "$file" "last_reviewed")"
    if [ -n "$reviewed" ] && ! echo "$reviewed" | grep -Eq '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'; then
      fail "$rel last_reviewed 格式错误: $reviewed（应为 YYYY-MM-DD）"
    fi
  else
    NO_META_COUNT=$((NO_META_COUNT + 1))
    echo "$rel" >> "$TMP_WITHOUT_META"
  fi
done < <(find "$DOCS_DIR" -type f -name '*.md' | sort)

if [ "$META_FILE_COUNT" -gt 0 ]; then
  ok "带元信息文档检查完成（共 $META_FILE_COUNT 个）"
else
  fail "未检测到任何带元信息文档"
fi

if [ "$NO_META_COUNT" -gt 0 ]; then
  warn "存在 $NO_META_COUNT 个未带元信息文档（暂作为遗留，不阻断）"
fi

# ─── Check 5: source_of_truth 主题唯一性 ────────────────────────────────────
echo ""
echo "=== [5] source_of_truth 主题唯一性 ==="

SOT_COUNT=0
TMP_SOT="$(mktemp)"
TMP_DUP_TOPICS="$(mktemp)"

while IFS= read -r file; do
  head_block="$(sed -n '1,40p' "$file")"
  if ! echo "$head_block" | grep -qE '^> status:[[:space:]]*'; then
    continue
  fi

  sot="$(lower "$(field_value "$file" "source_of_truth")")"
  if [ "$sot" != "yes" ]; then
    continue
  fi

  SOT_COUNT=$((SOT_COUNT + 1))
  rel="${file#$ROOT/}"

  topic="$(field_value "$file" "sot_topic")"
  if [ -z "$topic" ]; then
    # 兼容旧文档：未设置 sot_topic 时以文件名作为主题键
    topic="$(basename "$file" .md)"
  fi

  echo "$topic|$rel" >> "$TMP_SOT"
done < <(find "$DOCS_DIR" -type f -name '*.md' | sort)

if [ "$SOT_COUNT" -eq 0 ]; then
  warn "未检测到 source_of_truth: yes 文档"
else
  cut -d'|' -f1 "$TMP_SOT" | sort | uniq -d > "$TMP_DUP_TOPICS" || true

  if [ -s "$TMP_DUP_TOPICS" ]; then
    while IFS= read -r topic; do
      [ -z "$topic" ] && continue
      files="$(grep "^${topic}|" "$TMP_SOT" | cut -d'|' -f2- | tr '\n' ',' | sed 's/,$//')"
      fail "source_of_truth 主题冲突: $topic -> $files"
    done < "$TMP_DUP_TOPICS"
  else
    ok "source_of_truth 主题唯一性正常（共 $SOT_COUNT 个）"
  fi
fi

# ─── Check 6: plan 文档日期后缀 ──────────────────────────────────────────────
echo ""
echo "=== [6] plan 文档日期后缀 ==="

PLAN_CHECKED=0

while IFS= read -r file; do
  head_block="$(sed -n '1,40p' "$file")"
  if ! echo "$head_block" | grep -qE '^> status:[[:space:]]*'; then
    continue
  fi

  status="$(lower "$(field_value "$file" "status")")"
  sot="$(lower "$(field_value "$file" "source_of_truth")")"
  base="$(basename "$file")"
  rel="${file#$ROOT/}"

  case "$status" in
    active|draft|completed) ;;
    *) continue ;;
  esac

  if [ "$sot" = "yes" ]; then
    continue
  fi

  if echo "$base" | grep -qi 'plan'; then
    PLAN_CHECKED=$((PLAN_CHECKED + 1))
    if ! echo "$base" | grep -Eq '_[0-9]{8}\.md$'; then
      fail "$rel 为 plan 文档但文件名未带日期后缀（应为 *_YYYYMMDD.md）"
    fi
  fi
done < <(find "$DOCS_DIR" -type f -name '*.md' | sort)

if [ "$PLAN_CHECKED" -gt 0 ]; then
  ok "plan 文档日期后缀检查完成（共 $PLAN_CHECKED 个）"
else
  warn "未检测到参与规则校验的 plan 文档（需确认元信息是否已覆盖）"
fi

# ─── 汇总 ────────────────────────────────────────────────────────────────────
echo ""
if [ "$ERRORS" -gt 0 ]; then
  echo "❌ 检查未通过：共 $ERRORS 项问题需要修复"
  exit 1
else
  echo "✅ 全部检查通过（0 错误，$WARNINGS 警告）"
fi
