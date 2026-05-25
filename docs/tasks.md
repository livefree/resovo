# Resovo（流光） — 任务看板

> last_reviewed: 2026-05-24

---

## 进行中任务

（空 — 本会话累计 22+ commit / EP-3-A 全闭环 + sub B/C + AMD2-ADR/EP + PATCH-1/2 + EP-3-D / ImageHealth 4 列 + Merge 3 列 kind='computed' opt-out / AMD2 D-150-AMD2-2 首业务应用 / 待 @livefree dev server 走读 EP-3-D 或继续 EP-3-E）

---

## 下次会话恢复入口

**走读重点**（@livefree dev server / EP-3-D 后）：
1. `/admin/image-health` 域名表（mode=client）→ 默认前端过滤+排序（不变 / AMD2 client 哲学）
2. `/admin/image-health` 缺图视频表 → title + posterStatus 列 ⋯ trigger 可用（后端支持）/ posterSource / brokenDomain / occurrenceCount / lastSeenBrokenAt 4 子查询列 **无 ⋯ trigger**（kind='computed' / 业务真实禁用 / 子查询 SQL ORDER BY 复杂留 follow-up）
3. `/admin/merge` 候选表 → 3 列（titleNormalized / videoCount / score）**无 ⋯ trigger**（Segment 范式 / 非数据列表）
4. 4 已迁消费方零回退

**通过 → EP-3-E 启动**（SubtitlesListClient + SourcesClient ~0.3w / 含 sources 排序断链顺手修 / ADR-150 阶段 5 EP-4 部分）

**Follow-up 跟踪**：
- ImageHealth missing 表 4 子查询列 sort 全栈（CTE 重写 SQL）
- MergeClient 候选表 sortField=score 全栈（后端扩展 + 前端 sort state）
- AMD2 共享层 sortableFields / filterableFields 白名单机制（消费方提供列表 / DataTable 自动 opt-out）

---

## 本会话已完成 commit 链

1-15. EP-3-A 全闭环 + sub B + sub C（详见 changelog）
16. `68571ceb` **AMD2-ADR** ADR-150 AMENDMENT 2 起草
17. `d776f87b` **AMD2-EP** AMENDMENT 2 实施
18. `9888f7ac` **AMD2-PATCH-1** VideoListClient sort 守卫（反范式错误）
19. `2c6e3cf8` **AMD2-PATCH-2** 后端扩展 SORT_FIELDS / 撤回 PATCH-1 反范式
20. `<TBD>` **EP-3-D** ImageHealth + Merge 9 列 kind='computed' opt-out

总计 +4500+ lines / 80+ 新单测 / 0 回退 / ADR-150 AMENDMENT 2 范式根本反转兑现 / 全质量门禁全过。
