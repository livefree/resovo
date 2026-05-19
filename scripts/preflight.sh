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
# CHG-SN-6-CI-MIGRATE-DRY-RUN：先 dry-run 报告 pending 数量（防部署前 schema 滞后）
# 退出码 1 = 有 pending → 提示后继续实际 migrate；退出码 0 = 无 pending 直接通过
npm run migrate:check || echo "  ↑ 上述 pending 迁移将由下一步实际执行"
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

echo "[5e/6] 浮层透明遮罩守卫（SEQ-20260501-01 / CHG-DESIGN-17）"
npm run verify:no-bare-backdrop

echo "[5e2/6] 文件大小硬上限守卫（CHG-SN-7-PRE-01 / CLAUDE.md §绝对禁止第 11 条）"
npm run verify:file-size-budget

echo "[5f/6] ADR 协议合规自动核验（CHG-SN-5-CHECKLIST-AUDIT + CHG-SN-6-CHECKLIST-AUDIT-3 + RETRO-3-B/-4/-06）"
echo "  - verify:endpoint-adr                 — 新增端点 → ADR §端点契约存在性"
echo "  - verify:error-message                — ADR §错误码 message 模板对齐 (advisory)"
echo "  - verify:adr-d-numbers                — ADR D-N 偏离清单完成度 (advisory)"
echo "  - verify:sql-schema-alignment         — queries SQL 列引用 vs migration schema 核验 (advisory)"
echo "  - verify:style-shorthand-conflict     — React inline style shorthand+longhand 冲突 (FAIL fast，CHG-SN-6-06 升级)"
npm run verify:adr-contracts

echo "[6/6] 单元测试"
npm run test:run

if [[ "$WITH_E2E" == "true" ]]; then
  echo "[附加] E2E 测试"
  npm run test:e2e
fi

echo ""
echo "✅ preflight 完成，当前分支可进入持续开发流程。"
