#!/usr/bin/env bash
# scripts/verify-env.sh
# 开发环境验证脚本 — 在 INFRA-06 完成后运行，确认所有服务就绪
# 用法：bash scripts/verify-env.sh

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

PASS=0
FAIL=0

check() {
  local name="$1"
  local cmd="$2"
  printf "  %-40s" "$name"
  if eval "$cmd" &>/dev/null; then
    echo -e "${GREEN}✓${NC}"
    ((PASS++))
  else
    echo -e "${RED}✗ 失败${NC}"
    ((FAIL++))
  fi
}

# 读取 .env.local（若存在）
if [ -f .env.local ]; then
  export $(grep -v '^#' .env.local | xargs)
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Resovo（流光） 开发环境验证"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# ── 环境变量检查 ─────────────────────────────────────────────────
echo "[ 环境变量 ]"
check "DATABASE_URL"          '[ -n "${DATABASE_URL:-}" ]'
check "ELASTICSEARCH_URL"     '[ -n "${ELASTICSEARCH_URL:-}" ]'
check "REDIS_URL"             '[ -n "${REDIS_URL:-}" ]'
check "JWT_SECRET"            '[ -n "${JWT_SECRET:-}" ]'
check "NEXT_PUBLIC_API_URL"   '[ -n "${NEXT_PUBLIC_API_URL:-}" ]'
echo ""

# ── PostgreSQL ───────────────────────────────────────────────────
echo "[ PostgreSQL ]"
check "连接可用"              'psql "${DATABASE_URL}" -c "SELECT 1" -q -t'
check "videos 表存在"         'psql "${DATABASE_URL}" -c "\d videos" -q -t'
check "users 表存在"          'psql "${DATABASE_URL}" -c "\d users" -q -t'
check "video_sources 表存在"  'psql "${DATABASE_URL}" -c "\d video_sources" -q -t'
check "short_id 索引存在"     'psql "${DATABASE_URL}" -c "SELECT 1 FROM pg_indexes WHERE indexname='"'"'videos_short_id_key'"'"'" -q -t | grep -q 1'
echo ""

# ── Elasticsearch ────────────────────────────────────────────────
echo "[ Elasticsearch ]"
check "集群健康"              'curl -sf "${ELASTICSEARCH_URL}/_cluster/health" | grep -qE "\"status\":\"(green|yellow)\""'
check "resovo_videos 索引"  'curl -sf "${ELASTICSEARCH_URL}/resovo_videos" | grep -q "resovo_videos"'
check "IK 分词插件"           'curl -sf "${ELASTICSEARCH_URL}/_analyze" -H "Content-Type:application/json" -d "{\"analyzer\":\"ik_max_word\",\"text\":\"进击的巨人\"}" | grep -q "tokens"'
check "拼音插件"              'curl -sf "${ELASTICSEARCH_URL}/_analyze" -H "Content-Type:application/json" -d "{\"analyzer\":\"pinyin\",\"text\":\"巨人\"}" | grep -q "tokens"'
check "director .keyword 字段" 'curl -sf "${ELASTICSEARCH_URL}/resovo_videos/_mapping" | grep -q "\"director\""'
echo ""

# ── Redis ────────────────────────────────────────────────────────
echo "[ Redis ]"
check "连接可用 (PING)"       'redis-cli -u "${REDIS_URL}" PING | grep -q PONG'
check "读写正常"              'redis-cli -u "${REDIS_URL}" SET __verify__ ok EX 5 && redis-cli -u "${REDIS_URL}" GET __verify__ | grep -q ok'
echo ""

# ── Node.js 环境 ─────────────────────────────────────────────────
echo "[ Node.js ]"
check "Node.js >= 22"         'node -e "process.exit(parseInt(process.versions.node) >= 22 ? 0 : 1)"'
check "npm 可用"              'npm --version'
check "依赖已安装"            '[ -d node_modules ]'
check "TypeScript 编译通过"   'npx tsc --noEmit'
echo ""

# ── 汇总 ─────────────────────────────────────────────────────────
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if [ $FAIL -eq 0 ]; then
  echo -e "  ${GREEN}全部通过 ($PASS/$((PASS+FAIL)))${NC} — 环境就绪，可以开始开发 🎉"
else
  echo -e "  ${RED}$FAIL 项失败${NC}，${GREEN}$PASS 项通过${NC}"
  echo -e "  ${YELLOW}请修复以上失败项后重新运行${NC}"
  exit 1
fi
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
