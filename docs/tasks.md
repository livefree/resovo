# Resovo（流光） — 任务看板

> last_reviewed: 2026-05-26

---

## 进行中任务

（无）

---

## 下次会话恢复入口

EP-1C-CLEANUP-A ✅ 完成（dailyTimes 类型 required / 2 源 / 0 cascade）。剩余 cleanup 拆为：

- Cleanup-B1/-B2：补 8 个 test fixture 显式 dailyTimes 字段
- Cleanup-B3：删 5 处消费方 fallback（3 前端 + 2 后端）
- Cleanup-C：删 dailyTime alias 字段（双源类型 + zod schema + setConfig 写入清理）

或其他推迟项：
- N1-EP3b-2：拖拽 pan + viewport buffer + 30d 封顶
- N1-EP2-1：globalMutateRegistry 共享去重
- N1-EP2-2：cancelled level vs ADR-153 neutral 跨 ADR 分裂
- N1-EP2-3：verify-admin-shell-types-mirror.mjs drift 守卫脚本
