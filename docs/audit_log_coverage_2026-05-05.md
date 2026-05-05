# Admin Audit Log 覆盖率审计 · 2026-05-05

> 任务卡：CHG-SN-4-10-A（M-SN-4 milestone 收口预备）
> 真源：`docs/designs/backend_design_v2.1/M-SN-4-moderation-console-plan.md` v1.4 §3.0.5 + §11.5 第 5 项

## 结论

**❌ 不达标** — plan §3.0.5 要求 11 个 `action_type` 全覆盖，实测**只 5 个落地，漏 6 个**。

按 plan §11.5 收口准入第 5 项硬约束："✅ §3.5 audit log 写入位点全覆盖（grep 写端点 vs INSERT admin_audit_log）"，本项**当前不达标 → milestone 准入受阻**。

## 已覆盖（5 个 action_type）

全部位于 `apps/api/src/services/ModerationService.ts`：

| # | action_type | 实装行 | 调用入口 |
|---|---|---|---|
| 1 | `video.reject_labeled` | L85 | `routes/admin/moderation.ts` reject 端点 |
| 2 | `video.staff_note` | L111 | `routes/admin/videos.ts` staff_note 端点 |
| 3 | `staging.revert` | L131 | `routes/admin/staging.ts` revert 端点 |
| 4 | `video_source.toggle` | L146 | `routes/admin/videoSources.ts` toggle 端点 |
| 5 | `video_source.disable_dead_batch` | L164 | `routes/admin/videoSources.ts` disable-dead 端点 |

## 漏覆盖（6 个 action_type）

| # | action_type | plan §3.0.5 before/after 字段 | 路由实装位置 | 状态 |
|---|---|---|---|---|
| 1 | `video.approve` | `review_status / visibility / is_published` | `routes/admin/moderation.ts:394` POST `/admin/moderation/batch-approve`（单条 approve 路径在 ModerationService 内部分支） | ❌ 漏 |
| 2 | `video.visibility_patch` | `visibility` | `routes/admin/videos.ts:187` PATCH `/admin/videos/:id/visibility` | ❌ 漏 |
| 3 | `staging.publish` | `is_published / published_at` | `routes/admin/staging.ts:110` POST `/admin/staging/:id/publish` | ❌ 漏 |
| 4 | `staging.batch_publish` | `{ ids: [], skipped: [] }` | `routes/admin/staging.ts:139` POST `/admin/staging/batch-publish` | ❌ 漏 |
| 5 | `video.reopen` | `review_status` (rejected → pending_review) | `routes/admin/moderation.ts` POST `/:id/reopen`（plan v1.2 新增） | ❌ 漏 |
| 6 | `video.refetch_sources` | `{ triggered_at, source_count }` | `routes/admin/videoSources.ts:69` POST `/admin/videos/:id/refetch-sources` + `routes/admin/crawler.ts:793` POST `/admin/crawler/refetch-sources`（plan v1.2 新增） | ❌ 漏 |

## 影响评估

- **milestone 准入**：plan §11.5 第 5 项硬约束 → 不达标
- **milestone 评级**：arch-reviewer 在 §11.3 评级 prompt 第 4 项明确要求"audit log 覆盖率（grep 写端点 vs admin_audit_log 写入位点）"，6/11 漏 → 极可能 **C 评级 → BLOCKER**
- **业务后果**：6 类关键写操作（含 publish / approve / visibility 变更）无 admin_audit_log 留痕 → 合规审计盲区 + 排障无回溯

## 处理路径候选

### 路径 A：BLOCKER 上报，停 milestone 推进

按 plan §11.5 硬约束失败应立即写 BLOCKER 暂停 -10-B / -10-C / -10-D，等 audit 补全后再继续。

### 路径 B（推荐）：立 CHG-SN-4-10-A2 修补卡，并行 -10-B/C 推进

新建 `CHG-SN-4-10-A2 · audit log 6 处补全`：
- 工作量：~3-4h（6 个端点 × 在 service 层加 `auditSvc.write` fire-and-forget 调用 + 单测）
- 与 -10-B（visual baseline）、-10-C（e2e）并行不冲突
- -10-D arch-reviewer 评级前必须完成 -10-A2

### 路径 C：豁免登记到 milestone audit 文档

接受 6 处漏覆盖作为 milestone 评级 B 级欠账（带 `DEBT-SN-4-A2 · audit log 6 处补全`），cutover 前清零。
- 风险：arch-reviewer 可能不接受这种豁免（plan §11.5 第 5 项是 must，不是 should）

## 建议

**路径 B**。理由：
1. 6 处漏是**实装疏漏**（不是设计争议）— 服务层加 5 行代码 × 6 处的机械性补全
2. 工作量可控（~3-4h），不影响 -10-B/C 主线推进
3. milestone 评级阶段（-10-D）能拿到全覆盖证据 → 评级 A 概率高

**等待用户裁定**：路径 A / B / C。

## 工具脚本（可选）

```bash
# 覆盖率快速重检（CI 可用）
echo "=== plan §3.0.5 要求 11 个 action_type ==="
echo "video.approve video.reject_labeled video.staff_note video.visibility_patch \
video_source.toggle video_source.disable_dead_batch staging.revert staging.publish \
staging.batch_publish video.reopen video.refetch_sources" | tr ' ' '\n' | sort

echo ""
echo "=== 实际 actionType 字面量出现位置 ==="
grep -rnE "actionType:\s*['\"]" apps/api/src 2>/dev/null | grep -v "\.test\."
```
