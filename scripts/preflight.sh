#!/usr/bin/env bash
# scripts/preflight.sh
# 开发前稳态检查：拉起依赖服务并执行核心校验链路
# 用法：
#   bash scripts/preflight.sh
#   bash scripts/preflight.sh --with-e2e

set -euo pipefail

WITH_E2E=false
if [[ "${1:-}" == "--with-e2e" ]]; then
  WITH_E2E=true
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Resovo 开发前稳态检查（preflight）"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

echo "[1/6] 启动基础依赖服务（Docker Compose）"
docker compose up -d

echo "[2/6] 校验环境变量与基础服务连通性"
bash scripts/verify-env.sh

echo "[3/6] 执行数据库迁移（幂等）"
npm run migrate

echo "[4/6] TypeScript 类型检查"
npm run typecheck

echo "[5/6] Lint 检查"
npm run lint

echo "[5b/6] server-next 边界隔离检查（plan §4.6）"
npm run verify:server-next-isolation

echo "[5c/6] admin 专属 token 反向跨域守卫（ADR-102 第 5 层 / CHG-SN-1-09）"
npm run verify:token-isolation

echo "[5d/6] token 引用完整性校验（CHG-DESIGN-01 / SEQ-20260429-02）"
npm run verify:token-references

echo "[6/6] 单元测试"
npm run test:run

if [[ "$WITH_E2E" == "true" ]]; then
  echo "[附加] E2E 测试"
  npm run test:e2e
fi

echo ""
echo "✅ preflight 完成，当前分支可进入持续开发流程。"
