#!/usr/bin/env bash
# scripts/check-docs-format.sh
# CHORE-01: 检查 task-queue.md / changelog.md 文档规范
#
# 检查项：
#   1. task-queue.md 中已填写的时间字段格式为 YYYY-MM-DD HH:mm
#   2. changelog.md 中 **时间** 字段格式为 YYYY-MM-DD
#   3. task-queue.md 中序列 ID（SEQ-YYYYMMDD-XX）按文件出现顺序单调递增（尾部追加验证）
#
# 用法：bash scripts/check-docs-format.sh
# 兼容：macOS（BSD grep/sed）和 Linux（GNU grep/sed）

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TASK_QUEUE="$ROOT/docs/task-queue.md"
CHANGELOG="$ROOT/docs/changelog.md"

ERRORS=0

fail() {
  echo "❌ $1"
  ERRORS=$((ERRORS + 1))
}

ok() {
  echo "✅ $1"
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
# 提取文件中 SEQ ID 的首次出现顺序
ORDERED_SEQ=$(grep -oE 'SEQ-[0-9]{8}-[0-9]+' "$TASK_QUEUE" | awk '!seen[$0]++')
SORTED_SEQ=$(echo "$ORDERED_SEQ" | sort)

if [ "$ORDERED_SEQ" = "$SORTED_SEQ" ]; then
  ok "SEQ 序列 ID 顺序符合尾部追加规范"
else
  fail "SEQ 序列 ID 顺序异常（疑似头部插入）"
  echo "  文件出现顺序："
  echo "$ORDERED_SEQ" | sed 's/^/    /'
  echo "  排序后应有顺序："
  echo "$SORTED_SEQ" | sed 's/^/    /'
fi

# ─── 汇总 ────────────────────────────────────────────────────────────────────
echo ""
if [ "$ERRORS" -gt 0 ]; then
  echo "❌ 检查未通过：共 $ERRORS 项问题需要修复"
  exit 1
else
  echo "✅ 全部 3 项检查通过"
fi
