#!/usr/bin/env bash
set -euo pipefail

# clear-local-db.sh
# 用途：清空本地数据库中的采集与视频内容数据（保留 users/system_settings/crawler_sites）
# 用法：
#   scripts/clear-local-db.sh
#   scripts/clear-local-db.sh --with-es

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

if [[ ! -f ".env.local" ]]; then
  echo "❌ 未找到 .env.local"
  exit 1
fi

set -a
source .env.local
set +a

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "❌ DATABASE_URL 未设置"
  exit 1
fi

if [[ "${DATABASE_URL}" != *"localhost"* && "${DATABASE_URL}" != *"127.0.0.1"* ]]; then
  echo "❌ 安全保护：DATABASE_URL 不是本地地址，已拒绝执行"
  echo "   DATABASE_URL=${DATABASE_URL}"
  exit 1
fi

PSQL_BIN="${PSQL_BIN:-/opt/homebrew/bin/psql}"
if [[ ! -x "$PSQL_BIN" ]]; then
  PSQL_BIN="$(command -v psql || true)"
fi
if [[ -z "${PSQL_BIN}" || ! -x "${PSQL_BIN}" ]]; then
  echo "❌ 未找到可用 psql，请先安装 PostgreSQL 客户端"
  exit 1
fi

echo "⚠️  即将清空本地数据库中的视频与采集数据..."
"$PSQL_BIN" "$DATABASE_URL" -v ON_ERROR_STOP=1 -c "
BEGIN;
  DELETE FROM crawler_task_logs;
  DELETE FROM crawler_tasks;
  DELETE FROM crawler_runs;
  DELETE FROM videos WHERE deleted_at IS NULL AND metadata_source='crawler';
  UPDATE crawler_sites SET last_crawled_at = NULL, last_crawl_status = NULL;
COMMIT;
"

echo "✅ 数据库清理完成。"

if [[ "${1:-}" == "--with-es" ]]; then
  if [[ -z "${ELASTICSEARCH_URL:-}" ]]; then
    echo "⚠️  ELASTICSEARCH_URL 未设置，跳过 ES 清理"
    exit 0
  fi
  echo "⚠️  清理 Elasticsearch 索引 resovo_videos..."
  curl -sS -X POST "${ELASTICSEARCH_URL}/resovo_videos/_delete_by_query?conflicts=proceed&refresh=true" \
    -H "Content-Type: application/json" \
    -d '{"query":{"match_all":{}}}' >/dev/null
  echo "✅ Elasticsearch 清理完成。"
fi

