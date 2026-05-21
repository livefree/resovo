# M-SN-4 内容审核台上线实施方案

> 版本：v1.7（v1.0 → v1.1 → v1.2 → v1.3 → v1.4 → v1.5 → v1.6 → v1.7 修订日志见文末 §12）  
> 日期：2026-05-03（v1.7 FIX-B 治理升级 → LinesPanel 共享组件提取 · 暂停执行）；v1.6 = 2026-05-02；v1.0 ～ v1.5 = 2026-05-01 ～ 02  
> 作者：Engineering（claude-sonnet-4-6 辅助生成；v1.1 缺漏补全；v1.2 审核意见 12 项；v1.3 runner 字典序对齐；v1.4 修复 059/060 NOT NULL ineffective；v1.5 子方案锚点；v1.6 投产对齐 7 项偏差；v1.7 FIX-B 治理升级 + 提取草案）  
> 状态：CHG-SN-4-03 ～ -08 + SEQ-20260502-01 阶段 1（FIX-A/E/C/F + 09d hotfix）已完成；FIX-B ⏸ 暂停（提取草案见 v1.7 §1 链接）；FIX-D / FIX-CLOSE 待 FIX-B 治理结论  
> 依赖：CHG-SN-4-01（SplitPane）、CHG-SN-4-02（ModerationConsole mock）均已落地  
> 上游真源：`docs/server_next_plan_20260427.md` §6 M-SN-4（v2.5）  

---

## 0. 方案范围

本文档覆盖从视觉原型到生产可用的完整实施路径，包括：

- 数据库 schema 补全（**Migrations 052–060 共 9 张**，其中 **052 admin_audit_log** 前置补建 = M-SN-4 序列首位；v1.3 重排让 runner 字典序 = 部署顺序）
- 后端 API 新增与修改（含 ApiResponse 信封 / errorCode 枚举 / RBAC / audit log / 并发保护）
- 后台 Worker 设计（信号验证 + 分辨率采集；新建 `apps/worker` 独立 service）
- 前端 mock → 真实 API 接入（含状态保留型筛选、键盘流作用域、失败回滚、a11y、i18n、visual baseline）
- VideoEditDrawer 线路 / 图片 / 豆瓣三 Tab 真实 API 集成（v1.1 纳入）
- 任务卡映射（CHG-SN-4-03 ～ -10 + DEBT-SN-3-A）+ 并行轨道
- Milestone 收口（e2e 黄金路径 + 状态保留 5 步压力测试 + arch-reviewer A/B/C 评级）

**不在本期范围（v1.1 更新）：** 定时发布调度器、**视频合并 / 拆分功能实现（D-15 推迟 M-SN-5，原 D-08 占位仅保留路由跳转）**、WebSocket 实时推送、已发布历史 Tab（plan v2.5 标可选，本期不渲染）。

### v1.4 修订摘要（patch — 059/060 三步幂等 + safe convergence）

历经 stop hook 三轮反馈（第五"ineffective on normal upgraded databases" + 第六"ineffective on existing schemas" + 第七"do not safely converge existing schemas"）收敛为**三步幂等 + safe convergence 终版**：

**问题链（三轮反馈）：**
1. **第五轮**：v1.3 `ADD COLUMN ... DEFAULT 'x'`（无 NOT NULL）允许 NULL 写入 → schema 不强制
2. **第六轮**：v1.4 初版 `ADD COLUMN IF NOT EXISTS ... NOT NULL DEFAULT 'x'` 在列预存在时被 IF NOT EXISTS 跳过 → NOT NULL 不生效
3. **第七轮**：v1.4 第六轮版本 `ADD COLUMN ... CHECK`（无 DEFAULT）+ `UPDATE WHERE col IS NULL AND deleted_at IS NULL` → 软删除行漏 backfill → `SET NOT NULL` 扫全表（含软删除）失败

**v1.4 终版（safe convergence 三步幂等）：**
1. `ADD COLUMN IF NOT EXISTS col TEXT DEFAULT 'x' CHECK (...)`（带 DEFAULT 不带 NOT NULL）
   - 列不存在：PG 11+ fast default **自动 backfill 所有行（含软删除）**为 'x'
   - 列已存在：跳过；保持原状
2. `UPDATE col = 'x' WHERE col IS NULL`（**全表，无 deleted_at 过滤**）
   - 兜底 v1.3 残留：应用层期间显式插入过 NULL（含活跃期 NULL → 软删除后 NULL 残留）
   - 空表 / 已无 NULL 时 0 行影响
3. `ALTER COLUMN col SET DEFAULT 'x'; ALTER COLUMN col SET NOT NULL`（PG 幂等无副作用）
   - SET NOT NULL 扫全表此时全部非 NULL → 安全

**收敛行为：** 列预存在 / 不存在 + 任意 NULL 分布（含软删除行 NULL）→ 终态 NOT NULL DEFAULT 'x'。

**应用范围：** 059 quality_source（DEFAULT 'crawler'）+ 060 review_source（DEFAULT 'manual'）。

**types 同步收紧：** `reviewSource: ReviewSource | null` → `ReviewSource`；`qualitySource: QualitySource | null` → `QualitySource`。v1.2 stop hook"types lie about nullable"妥协 → v1.4 正解收敛（schema 强制 NOT NULL + types 非空 + safe convergence）。

**为何不全列三步：** 053–058 + 052 的 NOT NULL 列（如 053 状态机 / probe_status / render_status / actor_id）皆 M-SN-4 首次引入，existing schemas 不会预存在该列 → `ADD COLUMN IF NOT EXISTS ... NOT NULL DEFAULT` 在首次部署即生效。仅 059 quality_source / 060 review_source 因 v1.3 残留无 NOT NULL 列 + 应用层显式 NULL 插入风险需三步 + safe convergence 收敛。

### v1.3 修订摘要（minor — runner 字典序对齐）

stop hook 二次反馈"060-first migration order is not enforceable"。核实 `scripts/migrate.ts:50–52` 行为：runner 按文件名字典序遍历，无人为顺序协调能力。v1.2 §2.10 写的"060 优先 deploy"在 runner 行为下不可强制。**v1.3 重排编号让 audit_log 占 052（M-SN-4 序列首位）**，使 runner 字典序 = 设计部署顺序，约束自然成立。

新编号映射（旧 → 新）：
- 052 状态机 → 053
- 053 video_sources signal → 054
- 054 videos moderation fields → 055
- 055 review_labels → 056
- 056 crawler_sites user_label → 057
- 057 source_health_events line detail → 058
- 058 video_sources resolution detection → 059
- 059 videos review_source → 060
- **060 admin_audit_log → 052**（M-SN-4 首位）

仅文本 + 文件名 minor 修订；plan SQL 块内容、字段定义、ADR 决议、任务卡边界均未变。

### v1.2 修订摘要（minor — 审核意见 12 项）

仅文本修订，无新决策；分阻塞 / 警告 / 提示三级处理，详见 §12 v1.2 段。重点：

- 🔴 migration 数量统一为 9 张（060 + 052–059）
- 🔴 D-14 DecisionCard 下沉登记为跨应用层例外
- 🔴 apps/worker "本期单实例" 与水平扩展边界澄清
- 🟡 storageKey 全统一为点分小写 `.v1` + CI 守门
- 🟡 audit log 补 reopen / refetch-sources，前台 feedback 不入 audit
- 🟡 CHG-SN-4-09 编号空置不复用，M-SN-5 新开 CHG-SN-5-XX
- 🟡 §11.5 收口准入第 9 项：全 admin 列表 visual diff 无回归

### v1.1 修订摘要（高层）

1. **新决策 D-13 ～ D-18**：状态保留型筛选选型、共享组件下沉清单、拆分入口推迟、worker 部署归属、player_feedback 客户端实装位置、admin_audit_log 前置补建。
2. **§2 新增 Migration 060**：`admin_audit_log` schema 前置补建（M-SN-2 阶段未落地，原 plan §3 暗含的"audit 已就绪"假设不成立）。
3. **§3 七项共性约束**：ApiResponse 信封、errorCode 枚举、RBAC 矩阵、audit log 写入位点、并发保护、端点归属、统一类型入口。
4. **§4 worker 部署落地**：新建 `apps/worker` 独立 service；advisory lock 视频级聚合并发；熔断 + 退避；pino + request_id 可观测。
5. **§5 六项前端共性约束**：状态保留型筛选（基于 `useTableQuery`）、键盘流作用域、失败回滚、LoadingState/ErrorState 接线、i18n key 规范、a11y。
6. **§6 双柱图 BarSignal** 字段补全行新增（plan §3 复用矩阵明列下沉项，原 plan 缺）。
7. **§7 useTableQuery 接入策略 + visual baseline** 7 张截图基线纳入。
8. **§8 重写为任务卡映射表**：替代原 4 周日历，对齐 task-queue.md / workflow-rules.md / 模型路由协议。
9. **§9 追加 5 项风险**：useTableQuery 替换回归 / admin-ui 下沉对 server v1 影响 / ~~7 张~~ **9 张**（v1.2 数字修正）migration 顺序部署 / arch-reviewer 评级 C / player_feedback PII 泄露。
10. **§10 拆分入口偏离登记**：D-15 推迟 M-SN-5，登入 plan §6 完成判据偏离表。
11. **新增 §11 Milestone 收口**：e2e 黄金路径 4 用例 + 状态保留 5 步压力测试 + arch-reviewer A/B/C 评级 + DEBT-SN-3-A 关闭。
12. **新增 §12 修订日志**。

---

## 1. 设计决策汇总

以下决策基于调研结论与产品建议，已最终确认：

| 编号 | 决策点 | 结论 |
|------|--------|------|
| D-01 | 退回审核状态转换白名单 | 允许 `approved\|internal\|0 → pending_review\|internal\|0` 和 `approved\|hidden\|0 → pending_review\|hidden\|0` |
| D-02 | 跳过（Skip）语义 | 纯前端操作，不写 DB；视频保持 `pending_review`；仅在当前会话内跳过排序 |
| D-03 | 拒绝操作 | 弹出 Modal，选预设标签 + 可选附言；未选标签默认 `other`（其他） |
| D-04 | 队列加载方式 | cursor 分页 + 虚拟滚动无限加载；approve/reject 后行淡出，自动聚焦下一条（Gmail 流） |
| D-05 | 线路"删除全失效" | 改为"禁用全失效"，设 `is_active=false`；线路不在审核台删除 |
| D-06 | "证据"按钮语义 | 展开单条线路的 `source_health_events` 历史，显示失效细节 |
| D-07 | 永久删除/批量删除 | **移除**；`rejected = hidden+unpublished` 已等价下架；视频信息客观存在 |
| D-08 | 拆分按钮 | 本期改为跳转至 `/admin/videos/:id/split`（返回 PlaceholderPage） |
| D-09 | 定时发布 | 本期按钮置 `disabled` + tooltip "功能开发中" |
| D-10 | 源站-线路关系 | 现有 `video_sources.source_site_key → crawler_sites` 已覆盖多对多语义，不额外建表 |
| D-11 | 线路显示名 | `crawler_sites.user_label`（新增）供前端用；`display_name` 供 admin 用；前端 fallback 链：`user_label ?? display_name ?? source_site_key` |
| D-12 | 分辨率获取策略 | 双轨制：热门视频主动采集（manifest parse）；普通视频被动获取（前端播放回报）；实测覆盖采集值 |
| **D-13** | **状态保留型筛选选型**（v1.1 新增；v1.2 命名统一）| 复用现有 `useTableQuery`（已落地 `VideoListClient.tsx:431`）；不引入 `nuqs` 等新依赖。URL params 主轨 + sessionStorage 兜底；**key 命名规范统一为点分小写 `.v1`**（详见 §5.0.1 表）；bump `.v1` → `.v2` 走破坏性升级协议（旧 key 数据回退到 default，不做迁移）。审核台 tab/筛选/activeIdx 全部纳入；右栏 rightTab 仅 sessionStorage（避免 URL 噪声）|
| **D-14** | **admin-ui 共享组件下沉清单**（v1.1 新增；v1.2 修订下沉触发协议）| **本期下沉 5 件**：(1) `BarSignal` 双信号双柱图（plan §3 复用矩阵明列）/ (2) `LineHealthDrawer` 证据抽屉（plan §3 复用矩阵明列）/ (3) `RejectModal` 预设标签 + 附言 / (4) `StaffNoteBar` amber 备注信息条 / (5) `DecisionCard` 由 `apps/server-next/src/app/admin/moderation/_client/` **上移** `packages/admin-ui/src/components/cell/`。**下沉触发协议**：CLAUDE.md 项目级通用规则为"3 处以上必须提取"；`docs/server_next_plan_20260427.md` §3 admin 子项目额外规则为"首次跨 2 视图复用即强制下沉"。`BarSignal` / `LineHealthDrawer` 在 plan §3 复用矩阵已明列"M-SN-4 下沉"，无需此协议判定。`DecisionCard` 跨 moderation + VideoEditDrawer = 2 处，仅满足 admin 子项目规则；本期下沉为**例外**，依据：(a) admin 子项目规则较严，covers 该场景；(b) 跨应用层（business `apps/server-next` ↔ shared `packages/admin-ui`）下沉天然受 Opus 评审约束；(c) 例外协议在 ADR 中登记。**强制升 Opus**：`arch-reviewer` 评审 5 件组件 Props 契约 + DecisionCard 下沉例外审议 |
| **D-15** | **拆分入口痛点 1**（v1.1 新增；原 D-08 偏离登记）| 本期**整体推迟 M-SN-5**（合并/拆分功能模块完整实装）；原 D-08 仅保留路由跳转 `PlaceholderPage` 不变。**plan §6 M-SN-4 完成判据偏离登记**：痛点 1（合并拆分入口）→ 推迟 M-SN-5；痛点 3（双信号）/ 痛点 6（筛选保留）保持本期解决。需 commit trailer + plan §6 备注同步 |
| **D-16** | **worker 部署归属**（v1.1 新增；v1.5 修订）| **新建 `apps/worker` 独立 service**（实测 `apps/` 当前 4 个：api / server / server-next / web-next；根 `package.json` 使用 npm workspaces）。理由：(a) Level 2 渲染验证 CPU/IO 重，与 apps/api 实时请求隔离更稳；(b) 与 logging-rules.md "worker job" 段已规划路径一致；(c) 独立部署便于后续水平扩展。**本期单实例运行**：本期采用单实例，熔断状态可存内存；多实例水平扩展为后续优化（须把熔断 / advisory lock 协调状态外移到 Redis 或 DB，纳入 M-SN-6 性能门或独立卡）。技术栈：Node.js + node-cron；worker 自建轻量 `pg.Pool`，复用 `DATABASE_URL` 等 env，不 import `apps/api` 内部文件。**仓内同步清单**：CHG-SN-4-06 任务卡须同步更新 (a) 根 `package.json` workspaces 列表 / (b) `CLAUDE.md`（如必要）/ (c) `TEMPLATES.md` / (d) `package-lock.json` / (e) CI 配置如存在则覆盖 apps/worker，不存在则 README 记录未配置 |
| **D-17** | **player_feedback 客户端实装位置**（v1.1 新增）| `packages/player-core` 新增 `feedback-reporter.ts` 事件埋点：(a) `onFirstFrame` → 上报 resolutionWidth/Height + success=true / (b) `onError` → 上报 errorCode + success=false / (c) `onBufferingEnd` → 累计 bufferingCount。客户端去抖：同一 (videoId, sourceId) 60s 内只上报最近一次最严重事件；shell 层 `PlayerShell` 注入实例。**PII 红线**：不上报 userId / IP，仅 hash(IP) 头 8 字节 + cookie session id 由后端解析 |
| **D-18** | **admin_audit_log 前置补建**（v1.1 新增；M-SN-2 欠账登记；v1.3 编号重排）| M-SN-2 阶段未实装审计日志 schema（核实结果：仓内 grep `admin_audit_log` 0 命中）。本期 **Migration 052** 前置补建（CHG-SN-4-03 任务卡内；v1.3 重排自原 060，使 runner 字典序 = 部署顺序）。schema 包含：actor_id / action_type / target_kind / target_id / before_jsonb / after_jsonb / request_id / created_at；写入位点详见 §3.0.5 |

---

## 2. 数据库迁移方案（Migrations 052–060）

### 2.1 Migration 052 — admin_audit_log 表（v1.3 重排自原 §2.9 / 060；M-SN-4 序列首位）

**目的：** D-18；M-SN-2 阶段未实装审计日志 schema，本期 M-SN-4 任何写端点上线前必须前置补建。runner 字典序遍历 → 052 必先于 053–060 跑，audit_log 表上线即就位。SQL 内容详见原 v1.2 §2.9（重命名为 052_admin_audit_log.sql）。

---

### 2.2 Migration 053 — 状态机扩展（退回审核）（v1.3 重排自原 §2.1 / 052）

**目的：** 解除"退回审核"的状态机 BLOCKER，允许已暂存视频退回待审核队列。

```sql
-- 053_state_machine_add_staging_revert.sql
-- 在 enforce_videos_state_machine() 白名单新增两条转换：
--   approved|internal|0 → pending_review|internal|0  （暂存退回待审）
--   approved|hidden|0   → pending_review|hidden|0    （隐藏态暂存退回）
-- 同时补充 StateTransitionAction 枚举值 'staging_revert'

CREATE OR REPLACE FUNCTION enforce_videos_state_machine()
RETURNS trigger LANGUAGE plpgsql AS $$
-- ... （在 transition whitelist 中新增两条 OR 分支）
--   OR (old_state = 'approved|internal|0' AND new_state = 'pending_review|internal|0')
--   OR (old_state = 'approved|hidden|0'   AND new_state = 'pending_review|hidden|0')
$$;
```

**同步代码改动：**
- `apps/api/src/db/queries/videos.ts`：`transitionVideoState` 加入 `'staging_revert'` 分支
- `apps/server-next/src/lib/videos/types.ts`：`StateTransitionAction` 联合类型新增 `'staging_revert'`

---

### 2.3 Migration 054 — 线路级信号列（v1.3 重排自原 §2.2 / 053）

**目的：** `video_sources` 新增每条线路独立的探测/渲染状态与延迟，取代仅有 `is_active` 的粗粒度状态。

```sql
-- 054_video_sources_signal_columns.sql
ALTER TABLE video_sources
  ADD COLUMN IF NOT EXISTS probe_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (probe_status IN ('pending', 'ok', 'partial', 'dead')),
  ADD COLUMN IF NOT EXISTS render_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (render_status IN ('pending', 'ok', 'partial', 'dead')),
  ADD COLUMN IF NOT EXISTS latency_ms      INT,           -- NULL = 未测量
  ADD COLUMN IF NOT EXISTS last_probed_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_rendered_at TIMESTAMPTZ;

-- 存量数据粗粒度回填（精确值由 SourceHealthWorker 首次运行后更新）
UPDATE video_sources vs
SET probe_status = CASE v.source_check_status
  WHEN 'ok'       THEN 'ok'
  WHEN 'partial'  THEN CASE WHEN vs.is_active THEN 'ok' ELSE 'dead' END
  WHEN 'all_dead' THEN 'dead'
  ELSE 'pending'
END
FROM videos v WHERE v.id = vs.video_id AND vs.deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_video_sources_probe_status
  ON video_sources(probe_status)
  WHERE deleted_at IS NULL AND is_active = true;

CREATE INDEX IF NOT EXISTS idx_video_sources_render_status
  ON video_sources(render_status)
  WHERE deleted_at IS NULL;
```

---

### 2.4 Migration 055 — 视频补充字段（v1.3 重排自原 §2.3 / 054）

**目的：** 新增 `staff_note`（审核员过程备注）和 `review_label_key`（预设拒绝标签键值）。

```sql
-- 055_videos_moderation_fields.sql
ALTER TABLE videos
  ADD COLUMN IF NOT EXISTS staff_note       TEXT,
  ADD COLUMN IF NOT EXISTS review_label_key TEXT;
-- review_label_key 软引用 review_labels.label_key，不加 FK（防标签演进锁死迁移）

COMMENT ON COLUMN videos.staff_note
  IS '审核员过程备注，不随状态迁移清空，可多次编辑';
COMMENT ON COLUMN videos.review_label_key
  IS '拒绝或标记时选用的预设标签 key，对应 review_labels.label_key';

CREATE INDEX IF NOT EXISTS idx_videos_review_label_key
  ON videos(review_label_key)
  WHERE deleted_at IS NULL AND review_label_key IS NOT NULL;
```

---

### 2.5 Migration 056 — 预设审核标签表（v1.3 重排自原 §2.4 / 055）

**目的：** 建立结构化的拒绝标签体系，支持审核数据分析。

```sql
-- 056_review_labels.sql
CREATE TABLE IF NOT EXISTS review_labels (
  id            UUID     PRIMARY KEY DEFAULT gen_random_uuid(),
  label_key     TEXT     NOT NULL UNIQUE,
  label         TEXT     NOT NULL,
  applies_to    TEXT     NOT NULL DEFAULT 'reject'
                         CHECK (applies_to IN ('reject', 'approve', 'any')),
  display_order INT      NOT NULL DEFAULT 0,
  is_active     BOOLEAN  NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO review_labels (label_key, label, applies_to, display_order) VALUES
  ('all_dead',        '全线路失效',   'reject',  1),
  ('duplicate',       '重复内容',     'reject',  2),
  ('violation',       '内容违规',     'reject',  3),
  ('cover_missing',   '封面缺失',     'reject',  4),
  ('incomplete_meta', '元数据不完整', 'reject',  5),
  ('low_quality',     '画质过低',     'reject',  6),
  ('region_blocked',  '地区限制',     'reject',  7),
  ('other',           '其他',         'any',    99)
ON CONFLICT (label_key) DO NOTHING;
```

---

### 2.6 Migration 057 — 线路显示名（crawler_sites 扩展）（v1.3 重排自原 §2.5 / 056）

**目的：** 为 `crawler_sites` 新增用户可见别名，与 admin 运维名称分离。

```sql
-- 057_crawler_sites_user_label.sql
ALTER TABLE crawler_sites
  ADD COLUMN IF NOT EXISTS user_label TEXT;

COMMENT ON COLUMN crawler_sites.user_label
  IS '面向前端用户的线路别名（如"主线"/"超清线"/"备用线"）；NULL 时降级到 display_name';
```

---

### 2.7 Migration 058 — source_health_events 扩展（v1.3 重排自原 §2.6 / 057）

**目的：** 关联单条线路，支持"证据"面板按线路查询健康历史。

```sql
-- 058_source_health_events_line_detail.sql
ALTER TABLE source_health_events
  ADD COLUMN IF NOT EXISTS source_id    UUID REFERENCES video_sources(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS error_detail TEXT,  -- HTTP 状态码 / 错误类型
  ADD COLUMN IF NOT EXISTS http_code    INT,
  ADD COLUMN IF NOT EXISTS latency_ms   INT;

CREATE INDEX IF NOT EXISTS idx_source_health_events_source_id
  ON source_health_events(source_id)
  WHERE source_id IS NOT NULL;
```

---

### 2.8 Migration 059 — 视频分辨率检测字段（v1.3 重排自原 §2.7 / 058）

**目的：** 区分"采集声明分辨率"与"实测分辨率"，实测值优先。

```sql
-- 059_video_sources_resolution_detection.sql
ALTER TABLE video_sources
  ADD COLUMN IF NOT EXISTS quality_detected TEXT
    CHECK (quality_detected IN ('4K', '2K', '1080P', '720P', '480P', '360P', '240P')),
  ADD COLUMN IF NOT EXISTS quality_source TEXT DEFAULT 'crawler'
    CHECK (quality_source IN ('crawler', 'manifest_parse', 'player_feedback', 'admin_review')),  -- v1.4: 三步幂等 Step 1（DEFAULT 让 PG fast default backfill 全表含软删除；NOT NULL 留待 Step 3）
  ADD COLUMN IF NOT EXISTS resolution_width  INT,   -- 实测像素宽
  ADD COLUMN IF NOT EXISTS resolution_height INT,   -- 实测像素高
  ADD COLUMN IF NOT EXISTS detected_at       TIMESTAMPTZ;

COMMENT ON COLUMN video_sources.quality_detected
  IS '实测分辨率档位；前端展示优先级：quality_detected > quality > NULL';
COMMENT ON COLUMN video_sources.quality_source
  IS '分辨率来源：crawler=采集时抓取 / manifest_parse=后台解析 / player_feedback=播放回报 / admin_review=审核时获取';
COMMENT ON COLUMN video_sources.resolution_width
  IS '实测视频宽度（像素），用于精确分辨率判断（如 1920×1080 vs 1280×720）';

-- v1.4 三步幂等 Step 2：全表清理 NULL 残留（**无 deleted_at 过滤**：软删除行也必须 backfill，
--   否则 Step 3 SET NOT NULL 扫全表会因软删除行 NULL 而失败 = "do not safely converge existing schemas"）
UPDATE video_sources SET quality_source = 'crawler' WHERE quality_source IS NULL;

-- v1.4 三步幂等 Step 3：强约束（PG 幂等 — 已 NOT NULL/DEFAULT 列重复设置不报错）
ALTER TABLE video_sources ALTER COLUMN quality_source SET DEFAULT 'crawler';
ALTER TABLE video_sources ALTER COLUMN quality_source SET NOT NULL;

-- 便于查找"质量缺失"线路优先探测
CREATE INDEX IF NOT EXISTS idx_video_sources_quality_null
  ON video_sources(probe_status)
  WHERE quality_detected IS NULL AND deleted_at IS NULL AND is_active = true;
```

**分辨率档位映射规则（应用层）：**

```
resolution_height ≥ 2160  → '4K'
resolution_height ≥ 1440  → '2K'
resolution_height ≥ 1080  → '1080P'
resolution_height ≥ 720   → '720P'
resolution_height ≥ 480   → '480P'
resolution_height ≥ 360   → '360P'
resolution_height < 360   → '240P'
```

---

### 2.9 Migration 060 — videos.review_source（v1.1 新增；v1.3 重排自原 §2.8 / 059）

**目的：** 区分审核来源（自动 / 手动 / 采集），右侧元数据面板显示极小 tag。

```sql
-- 060_videos_review_source.sql（v1.4 三步幂等模式 — safe convergence 终版）
-- Step 1: 列建表（CHECK + DEFAULT；不带 NOT NULL）
--   列不存在：PG 11+ fast default 自动 backfill 所有行（含软删除）为 'manual'
--   列已存在：IF NOT EXISTS 跳过；保持原状
ALTER TABLE videos
  ADD COLUMN IF NOT EXISTS review_source TEXT DEFAULT 'manual'
    CHECK (review_source IN ('auto', 'manual', 'crawler'));

-- Step 2: 全表清理 NULL 残留（**无 deleted_at 过滤**：软删除行也必须 backfill；否则 Step 3 失败）
UPDATE videos SET review_source = 'manual' WHERE review_source IS NULL;

-- Step 3: 强约束（PG 幂等 — 已 NOT NULL/DEFAULT 列重复设置不报错）
ALTER TABLE videos ALTER COLUMN review_source SET DEFAULT 'manual';
ALTER TABLE videos ALTER COLUMN review_source SET NOT NULL;

COMMENT ON COLUMN videos.review_source
  IS '审核来源：auto=规则自动通过 / manual=人工 / crawler=采集时初评';
```

> 原 v1.0 §6 显示补全表已列 `review_source` 但未列对应 migration，v1.1 补齐。

---

<!-- v1.3：原 §2.9 admin_audit_log 已移至 §2.1 / Migration 052（M-SN-4 序列首位）；以下保留 SQL 块作为字段参考，编号已重排。 -->

### 2.9-legacy（v1.3 已移至 §2.1 / Migration 052）— admin_audit_log 前置补建

**目的：** M-SN-2 欠账（D-18）；本期所有 admin 写操作均需写入审计日志。**实际文件：`apps/api/src/db/migrations/052_admin_audit_log.sql`（v1.3 重命名）。**

```sql
-- 052_admin_audit_log.sql
CREATE TABLE IF NOT EXISTS admin_audit_log (
  id            BIGSERIAL PRIMARY KEY,
  actor_id      UUID         NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  action_type   TEXT         NOT NULL,             -- 例：'video.reject_labeled' / 'staging.revert' / 'video.publish'
  target_kind   TEXT         NOT NULL,             -- 'video' / 'video_source' / 'staging'
  target_id     UUID,                              -- 主体目标，NULL 仅当 batch action
  before_jsonb  JSONB,                             -- 变更前关键字段快照
  after_jsonb   JSONB,                             -- 变更后关键字段快照
  request_id    TEXT,                              -- pino request_id（logging-rules.md）
  ip_hash       TEXT,                              -- hash(IP) 头 8 字节，PII 红线
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_log_actor_created
  ON admin_audit_log(actor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_target
  ON admin_audit_log(target_kind, target_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_action_created
  ON admin_audit_log(action_type, created_at DESC);

COMMENT ON TABLE admin_audit_log IS 'admin 写操作审计日志；M-SN-4 D-18 前置补建（M-SN-2 欠账）';
```

**写入位点：** 详见 §3.5。

---

### 2.10 编号占用与部署顺序（v1.3 重排：runner 字典序 = 部署顺序）

**runner 行为锚：** `scripts/migrate.ts:50–52` 按 `allFiles.filter(f => f.endsWith('.sql')).sort()` 字典序遍历执行（PRIMARY KEY = filename，无人为顺序协调能力）。v1.2 §2.10 的"060 优先 deploy"在 runner 行为下不可强制；v1.3 修订**重排编号让 audit_log 占 052**，使 runner 字典序 = 设计部署顺序，约束自然成立。

| 编号 | 占用（v1.3 重排）| 部署/回归约束 |
|---|---|---|
| **052** | **admin_audit_log 表**（v1.3 重排自原 060；M-SN-4 序列首位）| 不影响存量；先于 053 ～ 060 执行 → 任何后续 migration 之前 audit_log 已就位（虽然本期是单次 deploy，预留多 phase deploy 场景） |
| 053 | 状态机白名单（staging_revert）（v1.3 重排自原 052）| **必须**：提交前需准备"现有所有合法转换路径白名单的 SQL fixture 测试集"，部署前在 staging 跑通 |
| 054 | 线路 probe/render 列 + 索引（v1.3 重排自原 053）| 数据迁移幂等；存量 partial 视频 fallback `is_active` 判定；首次 SourceHealthWorker 运行后精确化 |
| 055 | videos.staff_note + review_label_key（v1.3 重排自原 054）| 索引仅在 review_label_key IS NOT NULL 时；不加 FK |
| 056 | review_labels 种子（v1.3 重排自原 055）| `INSERT … ON CONFLICT DO NOTHING`，幂等 |
| 057 | crawler_sites.user_label（v1.3 重排自原 056）| 默认 NULL，前端 fallback `display_name` |
| 058 | source_health_events.source_id（v1.3 重排自原 057）| source_id 可 NULL（兼容存量） |
| 059 | video_sources.quality_detected + 实测分辨率（v1.3 重排自原 058）| quality_detected/_width/_height/detected_at 默认空，按 §4.2 双轨写入；**quality_source NOT NULL DEFAULT 'crawler'** + **三步幂等模式**（v1.4：与 060 同模式，收敛 existing schemas v1.3 残留）；types 同步收紧非空 |
| 060 | videos.review_source（v1.3 重排自原 059）| **NOT NULL DEFAULT 'manual'** + **三步幂等模式**（v1.4：ADD COLUMN 不带 NOT NULL → UPDATE backfill NULL → ALTER COLUMN SET NOT NULL/DEFAULT；收敛 existing schemas v1.3 残留无 NOT NULL 列）；CHECK 3 值；types 同步收紧非空 |

**部署顺序（v1.3）：** `052 → 053 → 054 → 055 → 056 → 057 → 058 → 059 → 060`，**runner 字典序自动保证**，与 `scripts/migrate.ts` 现有行为一致；无需人为协调。

**回滚：** 每张 migration 须配套 down SQL（注释形式，与 049/050/051 同协议）；053（状态机）回滚前必须先回滚所有依赖该状态转换的写入端点（避免运行态写入失败）。

### 2.11 architecture.md 同步约束（v1.1 新增）

CLAUDE.md 绝对禁止"schema 变更不同步 `docs/architecture.md`"。CHG-SN-4-03 任务卡交付物**必须**包含：

- `docs/architecture.md` 新增 9 张 migration 的字段说明（按现有"DB schema"章节风格追加）
- `docs/decisions.md` 追加 ADR 草案（D-13 / D-14 / D-16 / D-17 / D-18 涉及结构性决策；D-13 useTableQuery 复用、D-14 共享组件下沉清单可在 commit message + plan 内闭环不出 ADR）
- `@/types`（packages/types）同步导出 `ReviewLabel` / `SourceHealthEvent` / `AdminAuditLog` / `PendingQueueRow` 等新类型，禁止 apps 内私有重复

---

## 3. 后端 API 方案

### 3.0 七项共性约束（v1.1 新增 — 全部端点必须满足）

#### 3.0.1 端点归属

| 路由前缀 | 实装位置 | 说明 |
|---|---|---|
| `/admin/moderation/*` / `/admin/staging/*` / `/admin/videos/*` | `apps/api/src/routes/admin/{moderation,staging,videos}.ts` 扩展 | apps/api v1 内（既有 admin 路由扩展，**非新建独立后端**）|
| `/admin/review-labels` | `apps/api/src/routes/admin/reviewLabels.ts`（新建） | 本期新建 |
| `/v1/feedback/playback`（route 内部 `/feedback/playback`） | `apps/api/src/routes/feedback.ts`（新建） | 前台路由，**不进 admin 鉴权**，走前台 rate-limit |
| `apps/server-next` proxy 层 | 复用现有 admin BFF / SWR 接入模式 | 仅做转发与 cookie 透传，不写业务逻辑 |

#### 3.0.2 响应格式

所有端点响应沿用 `docs/rules/api-rules.md` 现行规范，不引入新的 `{ success: true/false }` 信封：

```typescript
// 成功
{ data: T }
// 失败
{ error: { code: ErrorCode, message: string, status: number } }
```

不允许裸返业务对象 / 裸返数组；既有 4 个改端点只扩展 `data` 字段，不改变外层响应形态。

#### 3.0.3 errorCode 枚举（本期新增）

| code | HTTP | 触发位 | 文案（zh-CN） |
|---|---|---|---|
| `STATE_INVALID` | 409 | 状态机 trigger 拒绝 | 当前状态不允许此操作 |
| `LABEL_UNKNOWN` | 400 | reject-labeled 传未知 labelKey 且 fallback 关闭时 | 拒绝标签不存在 |
| `STAGING_NOT_READY` | 422 | publish 时 readiness 仍存在 critical 项且未传 force | 该视频未通过发布预检 |
| `REVIEW_RACE` | 409 | 同条视频已被其他审核员处理（updated_at 校验） | 已被其他审核员处理，请刷新 |
| `RATE_LIMITED` | 429 | feedback / 重测全部 / 补源超频 | 操作过于频繁，请稍候 |
| `SOURCE_PROBE_FAILED` | 502 | refetch-sources 触发 worker 失败 | 探测服务暂不可用 |

新错误码扩展在既有 `apps/api/src/lib/errors.ts`，不新建 `apps/api/src/types/error-codes.ts`。

#### 3.0.4 RBAC 矩阵

| 端点 | staff | moderator | admin |
|---|:-:|:-:|:-:|
| GET pending-queue / staging / videos?reviewStatus=rejected | ✅ | ✅ | ✅ |
| POST reject-labeled / approve / staging revert | ✅ | ✅ | ✅ |
| POST staging publish（单条）| — | ✅ | ✅ |
| POST staging batch-publish | — | — | ✅ |
| PATCH videos/sources（toggle / disable-dead）| ✅ | ✅ | ✅ |
| POST refetch-sources | ✅ | ✅ | ✅ |
| PATCH staff-note | ✅ | ✅ | ✅ |
| GET review-labels | ✅ | ✅ | ✅ |
| GET line-health/:sourceId | ✅ | ✅ | ✅ |

复用 apps/api 现行 `fastify.requireRole(['moderator', 'admin'])`；当前不存在 `requireStaff` 别名，本期不新增 staff 角色。

#### 3.0.5 audit log 写入位点

所有**写操作**（POST/PATCH/DELETE）成功路径上必须 fire-and-forget 写入 `admin_audit_log`：

| action_type | before/after 关键字段 |
|---|---|
| `video.approve` | review_status / visibility / is_published |
| `video.reject_labeled` | review_status, review_label_key, review_reason |
| `video.staff_note` | staff_note |
| `video.visibility_patch` | visibility |
| `video_source.toggle` | is_active |
| `video_source.disable_dead_batch` | { source_ids: [], count } |
| `staging.revert` | review_status |
| `staging.publish` | is_published / published_at |
| `staging.batch_publish` | { ids: [], skipped: [] } |
| `video.reopen`（v1.2 新增）| review_status（rejected → pending_review）|
| `video.refetch_sources`（v1.2 新增）| { triggered_at, source_count } — 手动触发 worker 留痕 |

**写入失败不阻塞主操作**（log warn + sentry breadcrumb）；request_id 来自 pino 中间件透传。

> **前台端点不入 admin_audit_log**（v1.5 修订）：`POST /v1/feedback/playback` 属前台用户路由（非 admin），不写入 `admin_audit_log`；其副作用经 worker / DB query 留痕，前台调用频率走 rate-limit + Sentry 即可。

#### 3.0.6 并发保护

| 端点 | 策略 |
|---|---|
| approve / reject-labeled / reopen | 复用 `transitionVideoState(..., { expectedUpdatedAt })`，基于 `videos.updated_at` 乐观锁；不一致 → `REVIEW_RACE` |
| staging publish | `WHERE id = $1 AND is_published = false AND review_status = 'approved'`（v1.2 加 `review_status='approved'` 防御"被退回 + 同时点发布"极端 race）|
| sources toggle / disable-dead | 不需要乐观锁（is_active 幂等） |
| staff-note | 末写入胜出（操作员意图明确） |

#### 3.0.7 类型与 zod schema

每个端点的 query / body / response **必须**有 zod schema，导出至 `packages/types/src/admin-moderation.types.ts` 供前端 SWR / fetcher 复用；端点实装不允许出现 `any`。

---

### 3.1 新增端点

#### GET /admin/moderation/pending-queue

虚拟滚动队列，cursor 分页（避免大偏移量 OFFSET 性能退化）。

```typescript
// Query params
interface PendingQueueQuery {
  cursor?: string       // opaque cursor（上次响应末条的 created_at + id 组合）
  limit?: number        // 默认 30，最大 50
  type?: VideoType
  sourceCheckStatus?: 'pending' | 'ok' | 'partial' | 'all_dead'
  doubanStatus?: 'pending' | 'matched' | 'candidate' | 'unmatched'
  hasStaffNote?: boolean
  needsManualReview?: boolean
}

// Response
interface PendingQueueResponse {
  data: VideoQueueRow[]   // 含 probe/render 聚合信号、staff_note、review_label_key
  nextCursor: string | null
  total: number           // 全量待审数（用于进度显示）
  todayStats: {
    reviewed: number
    approveRate: number | null
  }
}
```

#### POST /admin/moderation/:id/reject-labeled

带预设标签的拒绝，整合现有 `/admin/videos/:id/review`。

```typescript
interface RejectLabeledBody {
  labelKey: string    // review_labels.label_key，不传或未知值 → 'other'
  reason?: string     // 可选附言，最长 500 字
}
// 写入：videos.review_label_key = labelKey, videos.review_reason = reason ?? label.label
// 调用现有 transitionVideoState('reject')
```

#### PATCH /admin/moderation/:id/staff-note

更新 `videos.staff_note`，操作员随时可改，不触发状态迁移。

```typescript
interface StaffNoteBody {
  note: string | null   // null 清空
}
```

#### GET /admin/review-labels

获取有效预设标签列表，供拒绝 Modal 渲染。

```typescript
// Response: { data: ReviewLabel[] }
// 仅返回 is_active=true 的标签，按 display_order 排序
```

#### GET /admin/moderation/:id/line-health/:sourceId

单条线路的健康事件历史（"证据"面板）。

```typescript
// Query: page, limit（默认 20）
// Response: { data: SourceHealthEvent[], total }
// SourceHealthEvent: { id, origin, error_detail, http_code, latency_ms, created_at }
```

#### POST /admin/staging/:id/revert

暂存退回待审核，调用 migration 052 新增的状态转换。

```typescript
// Body: {} (无需额外参数)
// 执行：transitionVideoState(id, { action: 'staging_revert' })
// 成功后：video 从 staging 队列消失，出现在 pending-queue
```

#### PATCH /admin/videos/:id/sources/:sourceId

单条线路 toggle。

```typescript
interface SourcePatchBody {
  isActive?: boolean
  // 扩展预留：可后续加 probe_status 手动覆盖
}
```

#### POST /admin/videos/:id/sources/disable-dead

批量禁用该视频的所有 `probe_status='dead'` 线路。

```typescript
// Body: {}
// 执行：UPDATE video_sources SET is_active=false WHERE video_id=:id AND probe_status='dead'
// Response: { data: { disabled: number } }
```

### 3.2 已有端点修改

| 端点 | 修改内容 |
|------|---------|
| `POST /admin/videos/:id/review` | body 新增可选 `labelKey?: string`；未传时 `review_label_key` 写入 `'other'`（拒绝时）或不写入（通过时） |
| `POST /admin/moderation/batch-reject` | 同上新增 `labelKey` |
| `GET /admin/videos/:id` | 响应新增 `staff_note`、`review_label_key`、`needs_manual_review` |
| `GET /admin/staging` | 响应行新增 `quality_detected` 聚合（最高实测档位） |

### 3.3 前台反馈端点（apps/api 新增）

#### POST /v1/feedback/playback（route 内部 `/feedback/playback`）

用户播放成功/失败回报，用于被动获取分辨率和信号状态。

```typescript
interface PlaybackFeedbackBody {
  videoId: string
  sourceId: string
  success: boolean
  // 分辨率
  resolutionWidth?: number
  resolutionHeight?: number
  // 播放质量
  bufferingCount?: number   // 缓冲次数
  errorCode?: string
}
// 速率限制：同一 (userId|IP, sourceId) 每分钟 1 次
// 副作用：
//   success=true  → 更新 probe_status='ok'（如之前为 dead），写 quality_detected（如未知）
//   success=false → 记录 source_health_events，连续 3 次失败 → 触发 Level 2 验证
//   resolutionWidth/Height 存在 → 更新 video_sources.resolution_width/height/quality_detected/quality_source='player_feedback'
```

---

## 4. 后台 Worker：SourceHealthWorker 扩展

### 4.0 部署归属与基础设施（v1.1 新增 — D-16）

#### 4.0.1 新建 `apps/worker` 独立 service

仓内 `apps/` 当前实测 4 个：`api` / `server` / `server-next` / `web-next`（与根 `package.json` workspaces 列表一致）。本期前置创建 `apps/worker`，无既有 worker app 冲突。

> **注：** `CLAUDE.md` 文件模板章节出现的 `apps/web/...` 为 v1 时期旧表述（`apps/web` 已迁移为 `apps/web-next`），实际目录不存在。CHG-SN-4-06 视情况一并修订该处文档。

```
apps/worker/
├── package.json                 # @resovo/worker
├── tsconfig.json
├── src/
│   ├── index.ts                 # 入口，启动 cron + queue consumer
│   ├── config.ts                # env / cron 表达式集中
│   ├── jobs/
│   │   ├── source-health/
│   │   │   ├── level1-probe.ts
│   │   │   ├── level2-render.ts
│   │   │   └── aggregate-source-check-status.ts
│   │   └── feedback-driven-recheck.ts
│   ├── lib/
│   │   ├── db.ts                # 自建轻量 pg.Pool；零 apps/api 内部 import
│   │   ├── advisory-lock.ts     # pg_advisory_xact_lock 封装
│   │   ├── circuit-breaker.ts   # 站点级熔断
│   │   └── parsers/             # m3u8 / mp4 moov / mpd manifest
│   └── observability/
│       └── logger.ts            # pino + request_id（手动生成 worker job id）
└── tests/
```

#### 4.0.2 调度配置

| job | 调度 | 来源 |
|---|---|---|
| `source-health.level1-probe` | `0 */6 * * *`（每 6h）| node-cron + DB queue |
| `source-health.level2-render` | 触发驱动（无固定 cron）| 接 §4.1 Level 2 触发条件 a–e |
| `aggregate-source-check-status` | 入队驱动（任意 probe_status 变化）| `LISTEN/NOTIFY` 或轻量轮询 |
| `feedback-driven-recheck` | 入队驱动 | `/v1/feedback/playback` 连续 3 次失败 |

cron 表达式集中在 `apps/worker/src/config.ts`，env 覆盖；不在代码里硬编码。

#### 4.0.3 advisory lock 视频级聚合并发

§4.3 视频级 `source_check_status` 聚合在多 worker 并行下需上锁：

```sql
BEGIN;
SELECT pg_advisory_xact_lock( hashtext('video:'|| :video_id) );
-- 聚合 SQL（§4.3）
COMMIT;
```

锁粒度：单 video_id 行级；事务自动释放。

#### 4.0.4 站点级熔断 + 退避（**本期单实例**）

```
站点连续失败 ≥ 5 次（窗口 5 min）→ 熔断 30 min
熔断期内：probe / render 全部跳过该站点，记 source_health_events {origin: 'circuit_breaker'}
退避：失败 → 1s / 2s / 4s / 8s / 16s 指数（同一 source 重试上限 5 次/job）
```

实装位置：`apps/worker/src/lib/circuit-breaker.ts`，**状态存内存**（worker 重启清零，可接受）。

**单实例约束**（v1.2 澄清，与 D-16 一致）：内存熔断状态在多实例下会失效（每实例独立计数 → 实际站点请求量 = N×阈值）。本期 worker 单实例运行；多实例水平扩展须先把熔断状态外移到 Redis（或 DB advisory），列入后续优化（M-SN-6 性能门或独立卡）。CHG-SN-4-06 任务卡须在部署文档中标注"单实例"约束。

#### 4.0.5 可观测（pino + request_id）

每个 job 入口生成 `request_id = 'worker:'+ uuid()`，按 logging-rules.md 透传 child logger。必发指标：

| metric | 含义 |
|---|---|
| `worker.level1.run_duration_ms` | 单批 probe 耗时 |
| `worker.level1.success_rate` | 单批 ok 占比 |
| `worker.level2.trigger_count{by:auto/feedback/manual/cycle/quality_null}` | Level 2 触发分布 |
| `worker.level2.parse_failure_rate{by:hls/mp4/dash}` | manifest 解析失败率 |
| `worker.circuit_breaker.state{site_id}` | 熔断状态（active / cleared）|
| `worker.aggregate.lag_ms` | 聚合任务排队延迟 |

指标输出：阶段一仅 pino structured log（cutover 后接入 metrics backend）。

---

### 4.1 验证分级

```
Level 1 — Reachability（探测，轻量）
  触发：定时任务，每 6h 对全量 active sources
  方法：HEAD 请求 / m3u8 manifest 可达性（不解析内容）
  写回：video_sources.probe_status + last_probed_at
        source_health_events {origin:'scheduled_probe', source_id, http_code, latency_ms}
  并发限制：20 req/s，同一源站 5 req/s
  耗时：约 50ms/条（乐观）

Level 2 — Playability（渲染验证，重量）
  触发条件（任一满足）：
    a. probe_status 从 ok 变为 dead（风险升级触发）
    b. POST /feedback/playback 连续 3 次 success=false（用户反馈触发）
    c. 管理员点击"重测全部"（手动触发）
    d. 距上次 render check > 72h 且 probe_status='ok'（维护周期触发）
    e. quality_detected IS NULL（首次分辨率采集触发）
  方法：
    HLS → 解析 m3u8 获取清单，取最高分辨率流，发 HEAD 验证 ts segment 可达
    MP4 → Range: bytes=0-65535 请求，读取容器头部，解析 moov atom
    DASH → 解析 MPD manifest，取最高码率 representation
  写回：
    video_sources.render_status + last_rendered_at
    video_sources.latency_ms（首个 segment 响应时间）
    video_sources.quality_detected + resolution_width/height（如解析成功）
    video_sources.quality_source = 'manifest_parse'
    source_health_events {origin:'render_check', source_id, error_detail}
  并发限制：5 req/s（重量操作），同一源站 2 req/s
```

### 4.2 分辨率采集策略

```
热门视频（videos.trending_tag = true OR 近 7 天播放 > 阈值）
  → Level 2 定期主动运行，间隔 24h
  → 确保 quality_detected 及时更新

普通视频
  → Level 1 每 6h 探测
  → Level 2 仅按上述触发条件运行
  → quality_detected 通过 player_feedback 被动填充

分辨率写入逻辑（应用层，quality_detected 字段）：
  if resolution_height:
    quality_detected = 按像素高度映射到档位枚举
  elif quality_detected 已有值（更新非首次）:
    如新实测与旧值不同 → 更新（以实测为准，记录 detected_at）
  quality 字段（crawler 原始值）不覆写，仅作 fallback
```

### 4.3 视频级 source_check_status 聚合更新

任意线路 probe_status 变化时，异步触发视频级聚合：

```sql
-- 聚合规则
UPDATE videos v SET source_check_status = (
  SELECT CASE
    WHEN COUNT(*) FILTER (WHERE vs.probe_status = 'ok') = COUNT(*) THEN 'ok'
    WHEN COUNT(*) FILTER (WHERE vs.probe_status = 'ok') > 0        THEN 'partial'
    WHEN COUNT(*) = 0                                              THEN 'all_dead'
    ELSE 'all_dead'
  END
  FROM video_sources vs
  WHERE vs.video_id = v.id AND vs.deleted_at IS NULL AND vs.is_active = true
)
WHERE v.id = :videoId;
```

---

## 5. 各操作实现细节

### 5.0 六项前端共性约束（v1.1 新增）

#### 5.0.1 状态保留型筛选（D-13 落地）

**完全替代** plan §6 已禁止的 `setListRefreshKey` 重挂载机制；复用 `useTableQuery`（已落地 `apps/server-next/src/app/admin/videos/_client/VideoListClient.tsx:431`）。

**纳入持久化的状态：**

| 状态 | URL params | sessionStorage key | 说明 |
|---|:-:|:-:|---|
| `tab`（pending/staging/rejected）| ✅ `?tab=` | — | 切 Tab 不丢筛选 |
| `activeIdx` | — | `admin.moderation.{tab}.activeIdx.v1` | 刷新回到上次审核位 |
| 队列筛选（type / sourceCheckStatus / doubanStatus / hasStaffNote / needsManualReview）| ✅ `?type=...&...` | `admin.moderation.{tab}.query.v1` | 同时持久化 URL + storage |
| `rightTab`（detail/history/similar）| — | `admin.moderation.rightTab.v1` | 不进 URL（噪声）|
| `rightOpen`（< 1280 自动折叠）| — | `admin.moderation.rightOpen.v1` | viewport hint，可选写入 |

**命名规范（v1.2 统一）：** 全小写、点分隔、最末段 `.v1` 表示版本；不允许大写 `V1` 或驼峰。CI grep 守门：`grep -rE 'admin\.moderation\.[^"]*\.(V[0-9]|v[0-9]+[A-Z])' apps/server-next/src/` 应 0 命中。

**完成判据可观测**：自动埋点 `setListRefreshKey` 调用次数 = 0（grep CI 守门）；筛选保留率打点（ratio = 切 Tab/刷新后还原成功次数 / 总切 Tab 次数）。

#### 5.0.2 键盘流作用域协议

```
全局快捷键优先级（高 → 低）：
  Cmd+1/2/⋯（全局导航，AdminShell）
  > Modal/Drawer focus trap（打开时 J/K/A/R/S 全部禁用）
  > input/textarea focus（任何输入框聚焦时禁用）
  > J/K/A/R/S（仅 ModerationConsole pending Tab 激活时）

实装：useKeyboardScope hook（admin-ui 落地，下沉清单 D-14 候选追加项；
首期可在 ModerationConsole 内置实现，下沉时机视后续复用）。
```

#### 5.0.3 失败回滚 + 乐观更新

| 操作 | 乐观更新 | 失败回滚 |
|---|---|---|
| approve / reject-labeled | 行淡出 + activeIdx++ | toast(error.message) + 行复位 + activeIdx-- |
| sources toggle | 即时切换 visual | toggle 复位 + toast |
| disable-dead | 失效线路批量灰化 | 全部复位 + toast |
| visibility patch | segment 即时切换 | 复位 + toast |
| publish | 行淡出 | 行复位 + toast |
| staff-note PATCH | 信息条即时刷新 | 复位 + toast |

toast 文案统一从 `apps/server-next/src/i18n/messages/zh-CN/moderation.ts` 取（§5.0.5）。

#### 5.0.4 LoadingState / ErrorState 接线点

复用 `@resovo/admin-ui` 已有原语：

| 位置 | 组件 |
|---|---|
| pending-queue 首屏 | `<LoadingState variant="skeleton" rows={10} />` |
| pending-queue 加载下一批 | 列表底部 spinner（不阻塞 UI）|
| LinesPanel 首屏 | `<LoadingState variant="inline" />` |
| LineHealthDrawer 内容 | 同上 |
| 端点失败 | `<ErrorState onRetry={...} />` |

#### 5.0.5 i18n key 命名规范

文案不允许中文硬编码（M-SN-6.5 a11y/i18n 验收门会拦截）。统一前缀 `admin.moderation.*`：

```
admin.moderation.title                      内容审核台
admin.moderation.tab.pending                待审核
admin.moderation.tab.staging                待发布
admin.moderation.tab.rejected               已拒绝
admin.moderation.action.approve             ✓ 通过
admin.moderation.action.reject              ✕ 拒绝
admin.moderation.action.skip                跳过
admin.moderation.toast.approve.success      已通过
admin.moderation.toast.approve.failure      操作失败：{reason}
admin.moderation.toast.race                 已被其他审核员处理，请刷新
admin.moderation.reject.modal.title         拒绝：{title}
admin.moderation.reject.modal.label.required 选择原因（必选）
admin.moderation.reject.modal.reason.optional 附加说明（可选）
admin.moderation.staff_note.placeholder     可补充审核备注…
admin.moderation.lines.retest_all           ↻ 重测全部
admin.moderation.lines.disable_dead         ✕ 禁用全失效
admin.moderation.staging.checks.title       发布就绪检查
admin.moderation.staging.action.publish     ↑ 发布上架
admin.moderation.staging.action.revert      ✕ 退回审核
admin.moderation.staging.action.batch_publish ↑ 全部发布
... （完整 key 表见 CHG-SN-4-07 任务卡）
```

本期仅 zh-CN，但 key 必须经 `t()` 调用。

> **项目定位说明（v1.2 补充）：** 项目主体定位"国际化视频资源聚合索引平台"，国际化主要面向**前台**（apps/web-next）；**后台审核台**仅运营人员使用，本期仅 zh-CN 可接受。`t()` 调用为后续 en-US / 多语言运营场景留出空间，避免 milestone 审计争议。

#### 5.0.6 a11y 要求

| 项 | 要求 |
|---|---|
| 焦点环 | 所有可交互元素 `:focus-visible` 必须有 outline（CSS 变量 `--focus-ring`）|
| RejectModal | focus trap + Esc 关闭 + 首次焦点落在第一个标签按钮 |
| LineHealthDrawer | 同上 |
| 键盘流提示 | KBD 角标对所有快捷键提供 aria-label |
| 对比度 | 决策卡 / 双信号 Pill / chip 文本 ≥ 4.5:1（M-SN-6.5 验收）|
| 队列虚拟滚动 | aria-rowcount + role="listbox" / "option" + aria-selected |

---

### 5.1 待审核 Tab — 操作流程

#### 队列加载与导航

```
初始加载：
  GET /admin/moderation/pending-queue?limit=30
  → 渲染虚拟列表，显示"484 条待审核 · 今日已处理 27"

滚动到列表底部 80% 时：
  GET /admin/moderation/pending-queue?cursor=<lastCursor>&limit=30
  → append 新条目到虚拟列表

approve/reject 操作后：
  1. 当前行执行淡出 + 向左滑出动画（200ms）
  2. activeIdx 自动移至下一条（环绕到列表头部时提示"本批已全部审核"）
  3. 如列表剩余 < 5 条，自动预加载下一批

skip 操作后：
  1. 当前行添加 🔁 视觉标记（前端状态，不写 DB）
  2. activeIdx 移至下一条
  3. 被跳过的条目保留在列表，可再次点击审核
```

#### 拒绝操作 — 交互详情

```
触发：点击"✕ 拒绝"按钮 或 按键 R

弹出紧凑 Modal（宽度 420px，不遮挡主内容区）：
  ┌─────────────────────────────────────┐
  │ 拒绝：{视频标题}                      │
  │                                     │
  │ 选择原因（必选，可快速点选）            │
  │ [全线路失效] [重复内容] [内容违规]      │
  │ [封面缺失] [元数据不完整] [画质过低]    │
  │ [地区限制]  [其他]                    │
  │                                     │
  │ 附加说明（可选）                       │
  │ ┌─────────────────────────────────┐ │
  │ │ 可补充具体原因...                  │ │
  │ └─────────────────────────────────┘ │
  │                                     │
  │              [取消]  [确认拒绝]       │
  └─────────────────────────────────────┘

默认选中"其他"（未选标签时直接确认 → labelKey='other'）
确认 → POST /admin/moderation/:id/reject-labeled {labelKey, reason}
成功 → Modal 关闭，队列行淡出，跳下一条
```

#### 通过操作

```
触发：点击"✓ 通过"或按键 A
直接 POST /admin/videos/:id/review {action: 'approve'}
成功 → 队列行淡出，跳下一条（无需确认）
状态变更：pending_review → approved+internal+unpublished（进入暂存队列）
```

#### staffNote 显示与编辑

```
位置：中央面板，DecisionCard 下方，仅在 staff_note 非空时渲染
样式：amber 信息条，左侧 ⚑ 图标
      "备注：{staff_note内容}"
      右侧 ✎ 按钮 → 展开 inline 文本框

编辑保存：
  PATCH /admin/moderation/:id/staff-note {note}
  保存后信息条更新（无页面刷新）
  note='' 或 null → 信息条隐藏
```

#### 线路面板（LinesPanel）— 真实数据

```
数据来源：GET /admin/videos/:id/sources
  返回每条线路：
    site（crawler_sites.user_label ?? display_name）
    probe_status / render_status / latency_ms / is_active
    quality_detected ?? quality

每行展示：
  [toggle] [user_label] [DualSignal] [latency] [▶ 展开]

"证据"展开（每行 ▶）：
  GET /admin/moderation/:id/line-health/:sourceId
  展开内嵌列表显示健康事件：
    时间 · 事件类型 · HTTP 状态码 · 错误详情

"重测全部" → POST /admin/videos/:id/refetch-sources
  触发 Worker Level 1+2 验证，异步，按钮短暂 loading

"禁用全失效" → POST /admin/videos/:id/sources/disable-dead
  成功 → 面板列表中失效线路 toggle 变灰，计数更新

线路 toggle → PATCH /admin/videos/:id/sources/:sourceId {isActive}
  即时响应，optimistic update

"重测全部" 移除原"证据"按钮，"证据"改为每行 ▶ 展开
```

---

### 5.2 待发布 Tab — 操作流程

#### 数据接入

```
队列：GET /admin/staging?limit=20&page=N
每条视频就绪检查（readiness）由后端计算并返回：
  ✓ 审核状态   → review_status = 'approved'
  ✓ 有效线路   → COUNT(probe_status='ok' AND is_active=true) >= 2
  ✓ 封面可达   → media_catalog.cover_url 非空且 poster_status='ok'
  ✓ 豆瓣匹配   → videos.douban_status = 'matched'（或 'candidate' 显示⚠）
  ✓ 播放信号   → source_check_status != 'all_dead'
```

#### 退回审核

```
触发：点击"✕ 退回审核"
弹出确认对话框："退回后视频将重新进入待审核队列，是否确认？"
确认 → POST /admin/staging/:id/revert
成功 → 该条从待发布列表消失，出现在待审核队列最前端
       显示 toast："已退回待审核"
```

#### 发布上架

```
触发：点击"↑ 发布上架"
若就绪检查存在 ✕ 项 → 弹出确认（"存在未通过检查项，仍要发布？"）
若全部 ✓ → 直接执行（无需确认）
POST /admin/staging/:id/publish
成功 → 从待发布列表移除，toast "已发布上架"
       同时触发 VideoIndexSyncService.syncVideo (ES 更新)
```

#### 全部发布（admin only）

```
POST /admin/staging/batch-publish
仅对 readiness='ready' 的视频执行，skipped 数回报给用户
```

#### 可见性切换

```
"公开 / 仅内部 / 隐藏" segment 按钮
即时调用 PATCH /admin/videos/:id/visibility {visibility}
无需页面刷新，optimistic update
```

#### 定时发布

```
Segment 按钮"定时"显示为 disabled 状态
鼠标悬停显示 tooltip："功能开发中"
```

---

### 5.3 已拒绝 Tab — 操作流程

#### 数据接入

```
GET /admin/videos?reviewStatus=rejected&page=N&limit=20
拒绝 banner 展示：
  review_label_key → 对应 label 文字（chip 形式，颜色 state-error）
  review_reason    → 附加说明
  reviewed_by UUID → JOIN users 表取 username 显示
  reviewed_at      → 格式化时间

移除按钮：✕ 永久删除、✕ 批量删除
```

#### 重新审核

```
POST /admin/moderation/:id/reopen（已存在）
成功 → 从已拒绝列表移除
       toast "已重新进入待审核队列"
       review_label_key 保留（供下次审核参考）
```

#### 补源后重审（两步流程）

```
第一步"触发补源"：
  POST /admin/videos/:id/refetch-sources
  按钮变为 loading，显示"补源中…"
  轮询 source_check_status（每 5s，最多 60s）
  source_check_status 变化 → 更新线路面板

第二步"重新审核"（补源结束后可用）：
  POST /admin/moderation/:id/reopen
  视频回到待审核队列
```

---

## 6. 数据显示补全方案（最小 UI 影响）

以下字段原 mock 未显示，在不改变三栏布局的前提下接入：

| DB 字段 | 显示位置 | 显示方式 |
|---------|---------|---------|
| `staff_note` | 中央面板，DecisionCard 下方 | amber 信息条，有值才渲染；可 inline 编辑 |
| `review_label_key` | 已拒绝列表行 + 拒绝 banner | 红色小 chip（如"全线路失效"） |
| `needs_manual_review=true` | 待审核队列行 | 橙色 ⚑ 小图标 |
| `meta_score` | 右侧面板"关键字段"区尾行 | `元数据完整度: 78/100`，低于 60 显示警告色 |
| `douban_status` 精确值 | 右侧面板豆瓣匹配区 | chip：待匹配/已匹配/候选/无匹配 |
| `review_source` | 中央面板视频标题旁 | 极小 tag（自动/手动/采集），仅管理员可见 |
| `quality_detected` | 线路面板每行 | `[user_label] [1080P实测]` |
| 线路 `latency_ms` | 线路面板每行 | `{N}ms`（已有位置，接真实数据） |
| 线路证据 | 线路面板每行展开 | `source_health_events` 列表 |
| **probe/render 聚合分布**（v1.1 新增）| **中央面板 DecisionCard 上方 / VideoEditDrawer 线路 Tab 头部** | **`<BarSignal probe={p} render={r} />`** 双柱图（plan §3 复用矩阵明列下沉项；x 轴 = 状态枚举 ok/partial/dead/unknown，y 轴 = 线路条数；与 DualSignal Pill 形成"宏观分布 vs 单路状态"双轨）|

---

## 7. 前端 Mock → 真实 API 接入清单

| 文件 | 当前状态 | 接入目标 |
|------|---------|---------|
| `ModerationConsole.tsx` | MOCK_VIDEOS + console.log | pending-queue API + 操作 API |
| `ModListRow.tsx` | MockVideo 类型 | VideoQueueRow 类型（含 probe/render 真实数据） |
| `PendingCenter.tsx` | console.log 操作 | 无 API 改动（操作由 ModerationConsole 传入） |
| `LinesPanel.tsx` | MOCK_LINES | GET /admin/videos/:id/sources + toggle/disable-dead API |
| `EpisodeSelector.tsx` | 纯 UI | 无 API 接入（集数来自 video.episode_count） |
| `DecisionCard.tsx`（v1.2 合并行）| probe/render mock，位于 `apps/server-next/.../moderation/_client/` | (1) 接入真实聚合信号 + StaffNoteBar 联动；(2) **同时上移** `packages/admin-ui/src/components/cell/`（D-14 下沉）|
| `StagingTabContent.tsx` | MOCK_STAGING_VIDEOS | GET /admin/staging；退回/发布接入 |
| `RejectedTabContent.tsx` | MOCK_REJECTED_VIDEOS | GET /admin/videos?reviewStatus=rejected；移除删除按钮 |
| 新增：`RejectModal.tsx` | — | 预设标签选择 Modal（**下沉 packages/admin-ui**，D-14）|
| 新增：`LineHealthDrawer.tsx` | — | 线路证据展开面板（**下沉 packages/admin-ui**，D-14）|
| 新增：`StaffNoteBar.tsx` | — | amber 备注信息条（**下沉 packages/admin-ui**，D-14）|
| 新增：`BarSignal.tsx`（v1.1）| — | probe/render 双柱图（**下沉 packages/admin-ui/cell**，D-14；plan §3 复用矩阵明列）|
<!-- v1.2 删除：DecisionCard 上移已合并到上方 DecisionCard.tsx 行（避免重复）-->

### 7.1 useTableQuery 接入策略（v1.1 新增 — 替换 setListRefreshKey）

```typescript
// ModerationConsole.tsx
// tab 由 URL params 主轨驱动（?tab=pending|staging|rejected）；
// 切 Tab 时通过 useSearchParams + router.replace 同步，不引入额外 useState。
const searchParams = useSearchParams()
const tab = (searchParams.get('tab') ?? 'pending') as TabId

const { snapshot, patch } = useTableQuery({
  storageKey: `admin.moderation.${tab}.query.v1`,  // v1.2 命名统一为点分小写 .v1
  defaults: { type: undefined, sourceCheckStatus: undefined, /* ... */ },
})

// approve/reject 后不重挂载列表，直接局部更新：
const onApprove = async () => {
  const optimistic = applyApproveOptimistic(activeIdx)  // 行淡出 + idx++
  try {
    await api.video.approve(v.id)
    // 不调 setListRefreshKey；不刷新查询；
    // 仅当 list 剩余 < 5 条时按 cursor 加载下一批
  } catch (e) { rollback(optimistic); toast(e); }
}
```

CI 守门：`grep -r "setListRefreshKey" apps/server-next/src/app/admin/moderation/ → 0 命中`。

### 7.2 visual baseline 截图清单（v1.1 新增）

`tests/visual/moderation/`（新建目录），CHG-SN-4-07 / -08 / -10 各阶段累积补齐：

| 截图 | 来源 |
|---|---|
| `pending-tab-default.png` | 待审 Tab 三栏默认状态 |
| `pending-tab-narrow-1280.png` | < 1280 右栏自动隐藏 |
| `staging-tab.png` | 待发布 Tab |
| `rejected-tab.png` | 已拒绝 Tab |
| `reject-modal.png` | RejectModal 8 标签 + 附言 |
| `line-health-drawer.png` | LineHealthDrawer 展开 |
| `bar-signal-mixed.png` | BarSignal 双柱图典型分布 |
| `staff-note-bar.png` | StaffNoteBar amber 信息条 |
| `video-edit-drawer-lines-tab.png` | VideoEditDrawer 线路 Tab 真实数据（CHG-SN-4-08）|

≥ 9 张 PNG；M-SN-3 dashboard visual diff 已建立同名 CI 模式，复用即可。

---

## 8. 任务卡映射与并行轨道（v1.1 重写）

> **替换原 4 周日历安排**：原日历未对接 `docs/task-queue.md` / `docs/rules/workflow-rules.md` / `docs/rules/parallel-dev-rules.md` / 模型路由协议。v1.1 重写为任务卡映射，每张卡可独立写入 task-queue.md 入队执行。

### 8.1 任务卡总览（序列号 SEQ-20260501-01）

| 卡号 | 范围 | 建议主循环模型 | 强制子代理 | 必跑命令 | 顺序 |
|---|---|---|---|---|:-:|
| **CHG-SN-4-03** | DB schema：052 audit_log + 053 状态机 + 054–060 字段（v1.3 重排：052=audit_log 序列首位 / 053=状态机 / 054=signal / 055=fields / 056=review_labels / 057=user_label / 058=health_events / 059=resolution / 060=review_source）；types 同步 + architecture.md 同步 + ADR 草案 | `claude-sonnet-4-6` | **`arch-reviewer` (claude-opus-4-7)**：跨 3+ 消费方 schema（CLAUDE.md 强制升 Opus 第 2 条）| typecheck + lint + unit + db migration test（含 053 状态机回归集）| 1 |
| **CHG-SN-4-04** | admin-ui 共享组件下沉 5 件（D-14）：BarSignal / LineHealthDrawer / RejectModal / StaffNoteBar + DecisionCard 上移 | `claude-sonnet-4-6` | **`arch-reviewer` (claude-opus-4-7)**：新共享组件 API 契约（CLAUDE.md 强制升 Opus 第 1 条）| typecheck + lint + unit (≥ 19 case/组件) + visual diff baseline（5 件）| 2 |
| **CHG-SN-4-05** | 后端 API：8 新端点 + 4 改动端点 + ApiResponse 信封 + errorCode 枚举 + RBAC + audit log + 并发保护 + zod schema → @/types | `claude-sonnet-4-6` | 否（每端点 zod schema 自审；如出现新 ADR 级决策再升 Opus）| typecheck + lint + unit + API contract test | 3 |
| **CHG-SN-4-06** | `apps/worker` 新建 + SourceHealthWorker Level 1+2 + 分辨率采集 + advisory lock 视频级聚合 + 站点熔断 + pino 可观测 | `claude-sonnet-4-6` | 否 | typecheck + lint + unit + worker integration test | 3（与 -05 并行）|
| **CHG-SN-4-07** | 审核台前端接入：useTableQuery 状态保留 + Gmail 流虚拟滚动 + 键盘流作用域 + RejectModal 接线 + LinesPanel 真实数据 + LineHealthDrawer 接线 + StaffNoteBar + i18n + a11y + visual baseline | `claude-sonnet-4-6` | 否 | typecheck + lint + unit + visual diff（7 张）| 4（依赖 -04 + -05）|
| **CHG-SN-4-08** | VideoEditDrawer 三 Tab 真实 API：线路 / 图片 / 豆瓣（依赖 054/059 字段 + apps/api admin/videos GET 扩展；v1.3 重排：原 053→054 / 058→059）| `claude-sonnet-4-6` | 否 | typecheck + lint + unit + visual diff（1 张）| 4（依赖 -04 + -05；可与 -07 并行）|
| **CHG-SN-4-09**（**编号空置 / 已退出本期**）| 拆分入口痛点 1（D-15 偏离登记 → 推迟 M-SN-5）| — | — | — | — |

> **编号空置协议（v1.2 新增）：** `CHG-SN-4-09` 编号**空置**，不重新分配；M-SN-5 拆分实装首张卡新开 `CHG-SN-5-XX`（具体编号由 M-SN-5 启动时 task-queue.md 当时序列决定）。task-queue.md 排队 M-SN-5 时不可复用 09 编号。
| **DEBT-SN-3-A** | `docs/server_next_view_template.md` 模板文档（M-SN-3 欠账，截止节点 M-SN-4 milestone 完成时）| `claude-haiku-4-5`（模板化文档）| 否 | docs lint + 索引更新 | 4（与 -07/-08 并行）|
| **CHG-SN-4-10**（M-SN-4 收口）| e2e 黄金路径 4 用例 + 状态保留 5 步压力测试 + arch-reviewer A/B/C milestone 评级 + DEBT-SN-3-A 关闭确认 | `claude-sonnet-4-6` | **`arch-reviewer` (claude-opus-4-7)**：milestone 评级 | 全栈 typecheck + lint + unit + e2e（PLAYER/AUTH/SEARCH/VIDEO + moderation 黄金路径）+ visual diff | 5（最后串行）|

### 8.1.1 子方案文档索引（v1.5 patch — 2026-05-02 审核闭环）

每张卡执行真源以本节链接的子方案文档为准，task-queue / tasks 卡片须引用对应文档：

| 卡 | 子方案文档 | 文档 revision | 状态 |
|---|---|---|---|
| CHG-SN-4-04 | `docs/designs/backend_design_v2.1/M-SN-4-04-admin-ui-shared-components-plan_20260502.md` | v1.1 | active（条件通过：路径 + 视觉验收 + trailer 已修订） |
| CHG-SN-4-05 | `docs/designs/backend_design_v2.1/M-SN-4-05-api-endpoints-plan_20260502.md` | v1.1 | active（5 项阻塞已闭环：信封 / RBAC / 状态机参数 / DB 字段 / ES 方法） |
| CHG-SN-4-06 | `docs/designs/backend_design_v2.1/M-SN-4-06-worker-source-health-plan_20260502.md` | v1.1 | active（DB pool 路径 / 058a 上移 -05 / CI 条件化） |

**v1.5 patch 关键调整**：

1. **058a schema patch 责任上移到 -05**：`source_health_events.processed_at` + partial index 由 -05 在自身范围内补齐（feedback 入队信号产生方应同时建表）；-06 的 Step 10 feedback-driven-recheck 必须等待 058a 上线，Step 1–9 可与 -05 并行
2. **响应信封回归 api-rules.md 现行规范**：成功 `{ data }` / 失败 `{ error: { code, message, status } }`；不引入新 `ApiResponse<T>` 信封；4 改端点响应外壳不变
3. **RBAC 实装真源**：apps/api 现行原语为 `fastify.requireRole(roles: string[])`，**不存在** `requireStaff`；本卡 8 admin 端点全部使用 `requireRole(['moderator', 'admin'])`
4. **状态机乐观锁参数对齐**：`expectedOld` → `expectedUpdatedAt`（与 `transitionVideoState` 现行签名一致）
5. **worker 跨 workspace 解耦**：apps/worker 自建轻量 pg.Pool，不 import apps/api 内部文件
6. **commit trailer 改用 git-rules.md §M-SN 扩展协议**（`Refs:` / `Plan:` / `Review:` / `Executed-By-Model:` / `Subagents:`）

**执行序**（用户 2026-05-02 裁定·两阶段·两轨并行）：

```
阶段 A（单卡）：CHG-SN-4-04（arch-reviewer Opus 契约冻结）
  ↓
阶段 B（双轨）：CHG-SN-4-05  ‖  CHG-SN-4-06
  ↓
阶段 C（多轨）：CHG-SN-4-07 + CHG-SN-4-08 + DEBT-SN-3-A
  ↓
阶段 D（收口）：CHG-SN-4-10
```

理由：-04 共享组件 Props 契约先冻结，消除 -05/-07/-08 返工根因（plan §9 风险条 "arch-reviewer milestone 评级 C → BLOCKER" 缓解策略）。

### 8.2 顺序与并行轨道

```
顺序约束：
  CHG-SN-4-03 (DB) ┐
                   ├─→ CHG-SN-4-05 (API) ┐
  CHG-SN-4-04 (admin-ui) ┘                ├─→ CHG-SN-4-07 (审核台前端) ┐
                          └─→ CHG-SN-4-06 (worker) ─→ ……              ├─→ CHG-SN-4-10 (收口)
                                                  └→ CHG-SN-4-08 (VideoEditDrawer 三 Tab) ┘
                                                  └→ DEBT-SN-3-A (模板文档) ─────────────┘

并行可启动（满足前置后）：
  Phase 1: 03（DB）
  Phase 2: 04（admin-ui）  —— 04 依赖 03 的 types？仅依赖 packages/types 同步部分；可早期并行
  Phase 3: 05（API）+ 06（worker）  —— 两轨并行
  Phase 4: 07（前端）+ 08（VideoEditDrawer）+ DEBT-SN-3-A  —— 三轨并行
  Phase 5: 10（收口）
```

### 8.3 分支与 commit 协议

- 分支：`track/m-sn-4-{03..10}`，按 `docs/rules/parallel-dev-rules.md` track 协议合并到 main
- commit trailer 模板：

```
<type>(<TASK-ID>): <summary>

Refs: CHG-SN-<milestone>-<seq>
Plan: docs/designs/backend_design_v2.1/M-SN-4-moderation-console-plan.md v1.5
Review: <arch-reviewer commit hash> PASS  # 无评审写 n/a
Executed-By-Model: claude-sonnet-4-6
Subagents: arch-reviewer (claude-opus-4-7) # 未调用写 none
```

### 8.4 任务卡共性约束（每卡均须满足）

- **开发前输出**：问题理解 / 根因判断 / 方案 / 涉及文件（quality-gates.md）
- **开发后输出**：六问自检 + 偏离检测 + `[AI-CHECK]` 结论块
- **执行模型审计**：tasks.md 卡片 "执行模型 / 子代理调用" 字段必填
- **typecheck / lint / unit 必须全绿**才允许 git commit（CLAUDE.md）
- **PLAYER / AUTH / SEARCH / VIDEO 任务**：CHG-SN-4-10 收口卡必跑 e2e

---

## 9. 风险与注意事项

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|---------|
| migration 052 影响现有状态机 trigger | 中 | 高 | 先在 staging 环境验证所有已有状态路径 |
| Level 2 验证对源站造成过多请求 | 中 | 中 | 严格速率限制；同一源站同时最多 2 并发 |
| cursor 分页与队列实时变化（新入库视频插入头部）导致重复 | 低 | 低 | cursor 基于 `created_at + id` 稳定排序；新入库视频在当前批次不重复 |
| worker 分辨率采集失败率高（源站反爬）| 高 | 低 | 失败不影响播放；降级到 quality 字段；记录错误 |
| 审核员批量 skip 后队列显示混乱 | 低 | 低 | skip 状态仅会话内有效；刷新后恢复原始顺序 |
| **useTableQuery 替换 setListRefreshKey 触发已有 admin 列表回归**（v1.1）| 中 | 中 | track 分支隔离；CHG-SN-4-07 必跑全 admin 列表回归 + visual diff；CI grep 守门 |
| **admin-ui 5 件下沉对 server v1（apps/server）的兼容回归**（v1.1）| 低 | 高 | server v1 已冻结仅维护期 bug 修复，确认其代码不引用新组件；`packages/admin-ui` 默认导出新组件不破坏旧导出 |
| **9 张 migration（052–060）顺序部署失败回滚**（v1.1；v1.2 数字修正 7→9；v1.3 编号重排）| 低 | 高 | 每张 migration 配套 down SQL；053 状态机回归集 staging 跑通后再 prod；052 audit_log = 序列首位天然 runner 字典序最先执行（v1.3 重排消除"优先 deploy"不可强制约束）|
| **arch-reviewer milestone 评级 C → BLOCKER**（v1.1）| 中 | 高 | CHG-SN-4-04 共享组件下沉时 Opus 预审先行，避免 -10 收口阶段才发现契约问题；M-SN-3 有先例 |
| **player_feedback PII 泄露（D-17）**（v1.1）| 低 | 高 | 客户端不上报 userId / IP；后端仅存 hash(IP) 头 8 字节；logging-rules.md PII redact；安全 review 列入 -05 任务卡门禁 |
| **DEBT-SN-3-B/C（staging 演练 + M-SN-3 阶段审计）连带影响 cutover 节奏**（v1.1）| 中 | 中 | 不阻塞 M-SN-4 milestone 完成，但 cutover（M-SN-7）启动前必须清；M-SN-4 收口卡（-10）须在评级文档中显式登记两项欠账状态 |
| **ES 索引同步在 reject-labeled / disable-dead 上的覆盖**（v1.1）| 中 | 中 | -05 任务卡明确：reject-labeled 触发 VideoIndexSyncService.unindexVideo；disable-dead 触发 reindex；contract test 覆盖 |

---

## 10. 明确不在本期的功能

| 功能 | 理由 | 后续计划 |
|------|------|---------|
| 定时发布 | 需独立调度器，复杂度高 | M-SN-5 or later |
| 视频拆分逻辑 | 独立大功能模块 | 本期仅跳转占位 |
| WebSocket 实时推送 | polling 先替代 | 后续优化 |
| 无源视频自动归档 | 需孤岛检测 job 配套 | source_health_events 基础设施就绪后 |
| 批量审核模式（多选快审）| 本期优先单条 Gmail 流 | 后续扩展 |
| 线路 user_label 管理 UI | 需独立配置页 | crawler 管理模块 |
| **视频合并 / 拆分功能完整实装**（v1.1，D-15 偏离登记）| 痛点 1 完整解决需独立 ADR + UX 设计；本期最小占位即可（D-08）| **整体推迟 M-SN-5**；plan §6 M-SN-4 完成判据偏离登记：痛点 1 → M-SN-5 解决 |
| **已发布历史 Tab**（v1.1）| plan v2.5 §6 M-SN-4 标"可选"；本期不渲染 | M-SN-5+ 视需求评估，可作为 RejectedTab 兄弟 Tab 接入 |
| **批量审核（多选快审）**（重申）| 本期优先单条 Gmail 流 | 后续扩展 |

---

## 11. Milestone 收口（v1.1 新增）

CHG-SN-4-10 任务卡的完整交付物。

### 11.1 e2e 黄金路径 4 用例（Playwright）

```
e2e/admin/moderation/
├── pending-approve-staging-publish.spec.ts
│   待审核 → 通过 → 进入 staging → 发布上架（黄金路径正向）
├── pending-reject-labeled-rejected.spec.ts
│   待审核 → 拒绝（选预设标签 + 附言）→ 已拒绝列表展示 → 重新审核
├── staging-revert-to-pending.spec.ts
│   staging → 退回审核（D-01 状态机扩展验证）
└── refetch-sources-then-reopen.spec.ts
    已拒绝 → 触发补源 → source_check_status 变化 → 重新进入待审核
```

### 11.2 状态保留 5 步压力测试（plan §6 M-SN-4 阶段审计重点）

```
Step 1: 进入 /admin/moderation?type=movie&sourceCheckStatus=partial
Step 2: 切到 staging Tab → 切回 pending Tab → 筛选保留 ✅
Step 3: 浏览器刷新 → URL params + sessionStorage 共同还原 ✅
Step 4: approve 第 N 条 → 行淡出 → activeIdx 自动 → setListRefreshKey 调用次数 = 0 ✅
Step 5: 在 list 剩余 < 5 条时 cursor 自动加载下一批 → 当前筛选保持 ✅
```

CI 守门（grep）+ 自动埋点筛选保留率 metric。

### 11.3 arch-reviewer A/B/C milestone 评级

调用模板（CLAUDE.md 模型路由）：

```
Task(subagent_type: "arch-reviewer", model: "claude-opus-4-7",
     prompt: "M-SN-4 milestone 阶段审计：(1) 双信号双轨实装 (DualSignal + BarSignal) 是否分双轨；
              (2) 状态保留型筛选 5 步压力测试结果；(3) admin-ui 5 件下沉契约稳定性；
              (4) audit log 覆盖率（grep 写端点 vs admin_audit_log 写入位点）；
              (5) DEBT-SN-3-A 模板文档关闭情况；
              评级：A=可进 M-SN-5 / B=带欠账可进 / C=BLOCKER 暂停")
```

输出：`docs/M-SN-4-milestone-audit-{date}.md`，A/B 可进 M-SN-5；C 写入 BLOCKER 暂停。

### 11.4 DEBT-SN-3-A 关闭确认

`docs/server_next_view_template.md` 模板文档已写入，覆盖：

- 任务卡卡头（来源 / 状态 / 交付物 / 质量门禁 / 模型 / 子代理 / 备注）
- 视图骨架（page.tsx + _client/ 组织规范）
- 数据接入（SWR / useTableQuery / mock-data 切换路径）
- 测试与 visual baseline 模板

CHG-SN-4-10 收口卡 PR 描述显式列"DEBT-SN-3-A 已关闭"+ 链接。

### 11.5 收口准入条件（must）

- ✅ 所有 CHG-SN-4-03 ～ -08 + DEBT-SN-3-A 全部 close
- ✅ §11.1 e2e 4 用例全绿
- ✅ §11.2 状态保留 5 步全部通过
- ✅ `grep -r "setListRefreshKey" apps/server-next/src/app/admin/moderation/` 0 命中
- ✅ §3.5 audit log 写入位点全覆盖（grep 写端点 vs INSERT admin_audit_log）
- ✅ visual baseline 9 张 PNG 已 commit
- ✅ §11.3 arch-reviewer 评级 A 或 B（带欠账）
- ✅ **全 admin 列表（视频库 / staging / 已拒绝 / 用户管理）visual diff 无回归**（v1.2 第 9 项；§9 风险缓解项落地）
- ✅ DEBT-SN-3-B / DEBT-SN-3-C 状态显式登记到 milestone 评级文档（不阻塞本 milestone，cutover 前清零）
- ✅ plan §6 M-SN-4 v2.5 完成判据三项中：痛点 3（双信号）/ 痛点 6（筛选保留）/ 筛选保留率 0%→100%可观测 三项达标；痛点 1 偏离登记到 M-SN-5

---

## 12. 修订日志

### v1.7 — 2026-05-03（patch — FIX-B 治理升级 → LinesPanel 共享组件提取 · 暂停执行）

**性质：** plan patch 级修订；用户 2026-05-03 调研 FIX-B 范围后判定"线路面板在多处可用（审核三 Tab + VideoEditDrawer + M-SN-5 合并/拆分），计划提取为 admin-ui 共享组件 + 暂停执行待 M-SN-5 / 前台播放页落地后敲定"。本 patch 仅记录治理决策 + 提取草案链接，无代码改动。

#### §1 决策（用户 2026-05-03 拍板）

原 FIX-B（1d，moderation 模块内重写）→ 升级为：
1. `packages/admin-ui` 新增 `composite/lines-panel/` + `cell/signal-chip` 共享组件（D-14 下沉清单 5 → 7 件）
2. 双消费方迁移：审核台 `LinesPanel.tsx`（247 行）+ VideoEditDrawer `TabLines.tsx`（214 行）
3. M-SN-5 合并/拆分页预留第 3 消费方契约空间
4. **执行暂停** — 待 M-SN-5 合并/拆分页面 + 前台播放页线路切换需求落地后再返回敲定

**提取草案文档（详细契约 + 视觉规约 + 风险）**：

> `docs/designs/backend_design_v2.1/M-SN-4-FIX-B-lines-panel-extraction-plan.md` v0.1

**已敲定决策点**（草案 §1 LP-01/03/04）：

| 编号 | 决策 |
|---|---|
| LP-01 | 共享组件位置 = `packages/admin-ui/src/components/composite/lines-panel/`（新建 composite 目录）|
| LP-03 | LineAggregate 字段命名 = camelCase（与 admin-ui 现有共享组件一致）|
| LP-04 | density variant 范围 = `'compact' \| 'regular' \| 'comfortable'`（含 M-SN-5 预留）|

**待敲定决策点**（草案 §1 LP-02/05/06）：

| 编号 | 待敲定 |
|---|---|
| LP-02 | 聚合工具函数位置（同包 vs 独立 utils）|
| LP-05 | 任务卡拆分方式（3 张串行 vs 单张大卡）|
| LP-06 | plan 版本同步（v1.7 单段记录 vs 单独 ADR-111）|

#### §2 同步影响

1. **task-queue.md SEQ-20260502-01 阶段 2**：FIX-B 状态 ⬜ → ⏸ 暂停 + 引用草案文档
2. **D-14 下沉清单**：原 5 件（BarSignal / LineHealthDrawer / RejectModal / StaffNoteBar / DecisionCard）→ 计划扩张至 7 件（追加 LinesPanel composite + SignalChip cell）；待 FIX-B 启动时 plan 同步
3. **FIX-CLOSE 收口卡**：需登记 v1.6 §2 视觉密度规约暂未对齐审核台 LinesPanel（FIX-B 暂停期间保持原状）作为已知偏离

#### §3 暂停期间观察清单

待以下事件之一落地后返回敲定：

1. M-SN-5 合并/拆分页面规划落地（D-15 推迟卡转入实装）
2. 前台播放页线路切换需求定型
3. DEBT-LINE-KEY-01 决策（是否在本提取期一并落地 line_key 一级概念）

#### §4 修订项

1. **plan §0 头部** 标注 v1.7 治理升级 + 状态更新（FIX-B ⏸ 暂停）
2. **新增 plan §12 v1.7 段**（本段）
3. **新建 `docs/designs/backend_design_v2.1/M-SN-4-FIX-B-lines-panel-extraction-plan.md` v0.1**（提取草案 — 完整 Props 契约 + 视觉规约 + 消费方迁移路径 + 风险清单 + 决策汇总表）
4. **task-queue.md SEQ-20260502-01 阶段 2 FIX-B 状态调整**

**人工 sign-off：** 已取得（用户 2026-05-03 决策"提取为共享组件 + 暂停 FIX-B 实装，待播放线路页面完成后再敲定"）。

**arch-reviewer 评审：** v1.7 仅治理决策记录 + 提取草案，无代码改动；FIX-B 启动时（FIX-B1 契约卡）走 `arch-reviewer (claude-opus-4-7)` 强制评审 LinesPanel + SignalChip + LineAggregate 共 3 件 Props 契约。

---

### v1.6 — 2026-05-02（patch — 投产对齐 · 7 项实装偏差修复）

**性质：** plan patch 级修订；用户人工试用 CHG-SN-4-07/-08 完成态后发现审核台距离投产仍有 7 项偏差，本次 patch 登记决策 + 视觉密度规约 + 设计对齐复核协议，落地序列 SEQ-20260502-01（task-queue.md）。无新功能决策（除筛选预设属本期补完）；无新 ADR。

#### §1 实装偏差清单（用户 2026-05-02 试用反馈）

| ID | 偏差 | 现状文件锚点 | 期望（设计稿/plan） | 修复卡 |
|---|---|---|---|---|
| G1 | "✎ 编辑视频"跳转到 `/admin/videos?q=` 视频库列表 | `apps/server-next/src/app/admin/moderation/_client/PendingCenter.tsx:133` | 打开 VideoEditDrawer（已实装的 4 Tab 抽屉，apps/server-next/src/app/admin/videos/_client/VideoEditDrawer.tsx）| FIX-A |
| G2 | LinesPanel 按 `video_sources` 行平铺（10 集 × 3 站 = 30 行），信息密度低，无选中态 | `apps/server-next/src/app/admin/moderation/_client/LinesPanel.tsx` | 按"线路"维度聚合，每条线路一行（典型 ≤ 5 行），32px 行高，7 字段信息密度，橙色选中态 | FIX-B |
| G2' | DecisionCard 顶部 BarSignal "探测/渲染聚合" 位置不合理（与播放器/标题区状态信息重叠）| `packages/admin-ui/src/components/cell/decision-card.tsx:174-181` | 删除 BarSignal 行 + caption；视频整体信号通过 LinesPanel 头部"线路 N/M 启用" + VisChip 已充分表达 | FIX-A |
| G3 | 决策卡按钮从 4 缩到 2（仅"编辑视频"+"前台"）| `apps/server-next/src/app/admin/moderation/_client/PendingCenter.tsx:132-135` | **本期决策保持现状 2 个**，未来再考虑快捷按钮 | ~~取消~~ |
| G4 | 右栏只有"详情"1 个 Tab（plan §5.0.1 D-13 storageKey 表明应有 detail/history/similar 三态）| `apps/server-next/src/app/admin/moderation/_client/ModerationConsole.tsx:68-87` (RightPaneDetail) | 三 Tab segment：详情 / 历史（review_log + audit_log）/ 类似（占位）；持久化 `admin.moderation.rightTab.v1` | FIX-C |
| G5 | 中央播放器仍是静态 ▶ 占位 div | `apps/server-next/src/app/admin/moderation/_client/PendingCenter.tsx:73-104` | 接入 packages/player-core 的 `Player`，**极简范围**（播放/进度/集数切换，不接 GlobalPlayerHost）；feedback-reporter D-17 顺带接入 | FIX-D |
| G6 | 缩略图直接 `<img>` 无 fallback / 无降级链 | `apps/server-next/src/app/admin/moderation/_client/{ModListRow,PendingCenter}.tsx` | 使用 packages/admin-ui/cell/Thumb 共享组件（已实装于视频库）| FIX-E |
| G7 | "筛选预设 / 保存预设"两按钮无 onClick | `apps/server-next/src/app/admin/moderation/_client/ModerationConsole.tsx:266-267` | 完整 CRUD（Popover 应用 / Modal 保存 / ⭐默认 / 删除 + 撤销）；纯 localStorage 不跨设备；URL params 主轨原则 | FIX-F |

#### §2 视觉密度规约（FIX-B 强制约束 — 参照 `docs/designs/screenshot/Screenshot 2026-05-02 at 20.15.54.png`）

**LinesPanel 单行结构（10 列 grid）：**

```
┌─┬───────┬─────────────┬──────┬──────┬──────┬──────┬──┬──┐
│●│ 线路N │ domain.com  │ NNms │ 探chip │渲chip │ 720P │✕│▶│
└─┴───────┴─────────────┴──────┴──────┴──────┴──────┴──┴──┘
 12  56     1fr           48     56      56     40   24 24
```

- **行 height**：32px（紧凑）；行间 1px solid `var(--border-subtle)`，无 gap
- **● 当前播放指示点**：仅选中行渲染，颜色 `var(--accent-default)`
- **选中行视觉态**：`background: var(--admin-accent-soft)` + `border-left: 2px solid var(--accent-default)`
- **SignalChip**（**新增 admin-ui/cell 组件，FIX-B 内交付**）：
  - 圆角 4 / padding 2px 6px / fontSize 10
  - 5 状态 × 2 类型 = 10 种文字 + 配色（全部 token，零硬编码）：
    - "探可达" / "渲可达" → `state-success-bg + state-success-fg`
    - "探部分" / "渲部分" → `state-warning-bg + state-warning-fg`
    - "探失败" / "渲失败" → `state-error-bg + state-error-fg`
    - "探待测" / "渲待测" → `bg-surface-raised + fg-muted`
    - "探未知" / "渲未知" → `bg-surface-raised + fg-muted` + opacity 0.6
- **域名提取**：从 `source_url` 解析 hostname，首条非空（fallback "—"）
- **延迟显示**：取活跃集中位数；NULL 显示 "—"
- **质量 tag**：取该线路下 `quality_detected` 最高档位（`4K > 2K > 1080P > 720P > 480P > 360P > 240P`）；无值不显示

**展开（▶ → ▼）**：

- padding-left: 28px
- 集数级 mini grid：每 cell 56×24，复用现有 `DualSignal`（dot variant）
- hover 显示 latency / 错误（title attribute）
- 点击集 cell 进入 LineHealthDrawer 该集事件

**工具栏底部（panel footer，height 32px）**：

- 左：📜 证据（chip btn，触发当前选中线路的 LineHealthDrawer）
- 中：spacer
- 右：✕ 禁用全部失效（chip btn danger style）

**头部**："线路 N/M 启用" + spacer + "↻ 重新抓取"（chip btn）

**零硬编码颜色**：CSS module + `var(--*)`，grep `#[0-9a-f]{3,6}` 在 LinesPanel + signal-chip 命中数 = 0

#### §3 数据模型决策（方案 B — 短期妥协）

**问题**：`video_sources` 表无 `line_key` 字段；用户场景"两站同名线路 X02 视觉合并"无 schema 支持。

**决策（用户 2026-05-02 拍板）**：

- **聚合键 = `(source_site_key, source_name)` 复合**（前端聚合，schema 不动）
- 视觉效果：每个 `(site, name)` 对一条线路，跨站不合并
- 截图证据：`Screenshot 2026-05-02 at 20.15.54.png` 中 5 条线路各对应一个独立域名，未见跨站合并场景，符合方案 B
- **DEBT-LINE-KEY-01 推迟 M-SN-5**：新增 `video_sources.line_key` + 运维合并 UI，实现真正的跨站线路合并；本期不动

#### §4 设计对齐复核协议（强制）

**触发**：每张 SEQ-20260502-01 任务卡完成时，除常规质量门禁外必须执行。

**协议**：

1. 卡片"完成判据"段后追加"**设计对齐复核**"段，列出 ≥ 5 项 checkbox
2. 复核维度覆盖：
   - **视觉密度**（行高、单元间距、单行信息字段数）
   - **token 使用**（grep 硬编码颜色 / 字号 / 间距 = 0）
   - **交互态**（hover / focus-visible / 选中 / disabled）
   - **a11y**（aria-label / aria-selected / 键盘可达）
   - **i18n**（无中文硬编码 — 沿用 plan §5.0.5 + DEBT-SN-4-07-C 协议）
3. 不允许"实现了即通过"——必须对照 `docs/designs/screenshot/` 截图 + plan v1.6 §2 视觉规约逐项核对
4. 复核结果写入卡片"设计对齐复核结论"段（落卡同时落 changelog）；若复核发现偏差但卡内无法修复，登记新欠账（DEBT-SN-4-FIX-X-XX）

**违反协议判定**：CHG-SN-4-FIX-CLOSE 收口卡的 arch-reviewer 评级若发现某张前置卡片未做设计对齐复核或复核流于形式（< 3 项 checkbox），降一档评级（A→B / B→C）。

#### §5 修订项

1. **plan §0 方案范围** 标注 v1.6 投产对齐 patch
2. **plan §6 显示补全表**：
   - "probe/render 聚合分布 / 中央面板 DecisionCard 上方" 行 → **删除**（v1.6 patch §1 G2'）
   - 改为：聚合分布通过 LinesPanel 头部"线路 N/M 启用" + VisChip 表达；DecisionCard 内不再渲染 BarSignal 行
3. **plan §7 mock→真实 API 接入清单**：
   - `LinesPanel.tsx` 行 → 标注"v1.6 重写为聚合视图（方案 B 复合键）"
   - 追加新增组件：`SignalChip`（admin-ui/cell，FIX-B 交付）/ `AdminPlayer`（server-next，FIX-D 交付）/ `RightPaneTabs`（server-next，FIX-C 交付）/ `FilterPresetPopover` + `SavePresetModal`（server-next，FIX-F 交付）
4. **plan §11.5 收口准入**：
   - 第 7 项"visual baseline 9 张 PNG 已 commit"维持，但内容更新 — 包含 lines-panel-collapsed/expanded（FIX-B）/ right-pane-{history,similar}（FIX-C）/ filter-preset-popover（FIX-F）/ player-loaded（FIX-D）/ edit-drawer-open（FIX-A）
5. **新增 plan §12 v1.6 段**（本段）

**人工 sign-off：** 已取得（用户 2026-05-02 19:30 ～ 21:00 试用反馈 + 三轮决策："方案 B / G3 取消 / G5 极简 / Player 极简 / similar 占位 / 设计对齐复核强制" 6 项确认）。

**arch-reviewer 评审：** 仅文本 patch 修订 + 序列任务卡入队，无代码改动；落地任务卡 CHG-SN-4-FIX-B 仍**强制走 `arch-reviewer` (claude-opus-4-7)**（SignalChip 新共享组件 Props 契约 + LinesPanel 聚合策略）；CHG-SN-4-FIX-CLOSE **强制走 `arch-reviewer` (claude-opus-4-7)** 全序列 milestone 复评级。

---

### v1.4 — 2026-05-01（patch — 059/060 三步幂等 + safe convergence）

**性质：** plan 自身 patch 级修订；历经 stop hook 第五、六、七共三轮反馈收敛为最终方案。无新决策、无新功能。

**问题链（三轮反馈）：**

1. **第五轮"ineffective on normal upgraded databases"：** v1.3 `ADD COLUMN ... DEFAULT 'x'`（无 NOT NULL）允许 NULL 写入 → 应用层可显式传 NULL → schema 不强制
2. **第六轮"ineffective on existing schemas"：** v1.4 初版 `ADD COLUMN IF NOT EXISTS ... NOT NULL DEFAULT 'x'` 在列预存在时被 IF NOT EXISTS 跳过整条 → NOT NULL 不生效 + 旧 NULL 行残留
3. **第七轮"do not safely converge existing schemas"：** v1.4 第六轮版本 Step 1 `ADD COLUMN ... CHECK`（无 DEFAULT）+ Step 2 `UPDATE ... WHERE col IS NULL AND deleted_at IS NULL` → 软删除行漏 backfill → Step 3 `SET NOT NULL` 扫全表（含软删除）失败 → migration 拒绝部署

**最终方案（三步幂等 + safe convergence）：**

```sql
-- Step 1: 列建表（CHECK + DEFAULT；不带 NOT NULL）
--   列不存在：PG 11+ fast default 自动 backfill 所有行（含软删除）为 'default'
--   列已存在（v1.3 残留）：IF NOT EXISTS 跳过；保持原状
ALTER TABLE t ADD COLUMN IF NOT EXISTS col TEXT DEFAULT 'default'
  CHECK (col IN (...));

-- Step 2: 全表清理 NULL 残留（**无 deleted_at 过滤**：软删除行也必须 backfill）
--   兜底 v1.3 残留：应用层显式插入 NULL（含软删除前活跃期 NULL 残留）
--   空表 / 已无 NULL 时 0 行影响
UPDATE t SET col = 'default' WHERE col IS NULL;

-- Step 3: 幂等强约束（PG SET 操作对已 NOT NULL/DEFAULT 列幂等无副作用）
--   SET NOT NULL 扫全表此时全部非 NULL → 安全
ALTER TABLE t ALTER COLUMN col SET DEFAULT 'default';
ALTER TABLE t ALTER COLUMN col SET NOT NULL;
```

**收敛行为：** 列预存在 / 不存在 + 任意 NULL 分布（含软删除行 NULL）→ 终态 NOT NULL DEFAULT 'default'。**safely converge** existing schemas（不会因软删除行 NULL 拒绝部署）。

**应用范围（仅 2 张）：** 059 quality_source（DEFAULT 'crawler'）+ 060 review_source（DEFAULT 'manual'）。其他列皆 M-SN-4 首次引入，无需此模式。

**修订项：**

1. **`apps/api/src/db/migrations/059_video_sources_resolution_detection.sql`** quality_source 改三步幂等 + safe convergence：Step 1 `ADD COLUMN ... DEFAULT 'crawler' CHECK` / Step 2 `UPDATE WHERE col IS NULL`（**无 deleted_at 过滤**）/ Step 3 `ALTER COLUMN SET DEFAULT/NOT NULL`；头部"幂等性深度分析"段同步
2. **`apps/api/src/db/migrations/060_videos_review_source.sql`** review_source 同模式；头部分析段同步
3. **`packages/types/src/admin-moderation.types.ts`** reviewSource / qualitySource 收紧非空（v1.2 stop hook"types lie about nullable"妥协 → v1.4 正解收敛）
4. **plan §0 修订摘要 v1.4 段** 重写为三轮反馈链 + safe convergence 终版说明
5. **plan §2.10 编号占用表** 060 行 + 059 行扩展为"NOT NULL DEFAULT + 三步幂等 + safe convergence 模式"
6. **plan §2.8 / §2.9 SQL 块** 与实装一致（三步全展开 + 软删除 backfill 注释）
7. **plan §12 v1.4 段** 重写（本段）：完整三轮反馈链

**PG 行为依据：**
- `ADD COLUMN ... DEFAULT 'x'`（无 NOT NULL）PG 11+ fast default：不重写表，全行（含软删除）backfill 'x'
- `ADD COLUMN IF NOT EXISTS` 列预存在时跳过整条 → 无法升级既存约束
- `UPDATE WHERE col IS NULL`（不限 deleted_at）：兜底含软删除；空 / 已无 NULL 时 0 行影响
- `ALTER COLUMN SET NOT NULL` / `SET DEFAULT` 对已设值列幂等；前者扫全表（含软删除）校验
- `CHECK (col IN (...))`：PG CHECK 对 NULL 自动 pass，不阻塞 NULL；NOT NULL 才是 NULL 拦截器

**人工 sign-off：** 已取得（用户授权 stop hook 三轮反馈逐项修复至 safe convergence 终版）。

**arch-reviewer 评审：** 仅 SQL 幂等模式 + types 收紧 patch 修订，无新决策；落地任务卡仍按既定走 `arch-reviewer` (claude-opus-4-7)。

---

### v1.3 — 2026-05-01（minor 修订 — runner 字典序对齐）

**性质：** plan 文档自身 minor 修订（仅文本 + 文件名重命名，无新决策、无新功能）；触发自 stop hook 反馈"060-first migration order is not enforceable"，核实 `scripts/migrate.ts:50–52` runner 行为后落地修复。

**根因：** v1.2 §2.10 写的"060 优先 deploy 确保 audit 全程覆盖"在仓内 runner 实装下不可强制。runner 按文件名字典序遍历执行，无人为顺序协调能力（无 deploy phase / 无 dependsOn 字段）。

**修订项：**

1. **文件重命名**：`apps/api/src/db/migrations/060_admin_audit_log.sql` → `052_admin_audit_log.sql`（git mv 保留历史）
2. **§0 方案范围**：标注 v1.3 编号重排让 runner 字典序 = 部署顺序
3. **§1 D-18**：admin_audit_log 编号从"Migration 060 前置补建"改为"**Migration 052** 前置补建（M-SN-4 序列首位；v1.3 重排自原 060）"
4. **§2 标题**：保持"Migrations 052–060"不变（共 9 张未变）；§2.1 ～ §2.9 小节内容按新编号重新映射，每节标注"v1.3 重排自原 §2.X / 旧编号"
5. **§2.1（新）**：原 §2.9（060 admin_audit_log）移至此处占用 052
6. **§2.2 ～ §2.9（新）**：原 §2.1 ～ §2.8 按 +1 编号顺延（053 状态机 / 054 signal / ... / 060 review_source）
7. **§2.10 编号占用与部署顺序**：重写为"runner 字典序 = 设计部署顺序"协议；表格逐行标注 v1.3 重排来源
8. **§7.1 / §8.3 commit trailer**：Migration 字段示例改为 `052,053,...,060`
9. **§9 风险表**："9 张 migration（060 + 052–059）顺序部署失败回滚" → "9 张 migration（052–060）..."；缓解措施"060 优先单独 deploy" → "052 audit_log = 序列首位天然 runner 字典序最先执行"
10. **packages/types/admin-moderation.types.ts**：所有 plan migration 编号引用按新映射调整（053→054 / 054→055 / ... / 060→052）
11. **apps/api/src/db/migrations/052_admin_audit_log.sql**：文件头注释 plan 章节锚 v1.2 §2.9 → v1.3 §2.1；部署顺序约束段重写为 runner 字典序协议
12. **新增 §12 v1.3 段**（本段）

**人工 sign-off：** 已取得（用户授权 stop hook 反馈逐项修复）。

**arch-reviewer 评审：** 仅文本 + 文件名 minor 修订，无代码 / 字段 / ADR 决议改动；落地任务卡（CHG-SN-4-03 / -04 / -10）仍按既定**强制走 `arch-reviewer` (claude-opus-4-7)**。

---

### v1.2 — 2026-05-01（minor 修订 — 审核意见 12 项）

**性质：** plan 自身 minor 修订（仅文本，无新决策）；触发自 arch-reviewer 等价审核（用户审核意见 12 项分阻塞/警告/提示三级）；按 plan §0 BLOCKER 协议，无新功能决策、无新 ADR，故仅 minor 增量。

**修订项（按审核意见编号对应）：**

🔴 **阻塞级（4 项）**
1. **migration 数量口径统一**：§0 / §9 风险表数字修正为"9 张（060 + 052–059）"；§2.10 表已正确（无改动）
2. **D-14 下沉触发例外协议**：澄清 CLAUDE.md "3 处规则" vs admin 子项目 "2 处规则" 关系；DecisionCard 跨应用层下沉登记为例外，依据 + 协议写入决策表，纳入 Opus 审议
3. **apps/worker 实测复核**：§4.0.1 标注实测 4 apps 与 workspaces 一致；CLAUDE.md `apps/web/...` 旧表述加注脚；D-16 增加"仓内同步清单"5 项（package.json workspaces / CLAUDE.md / TEMPLATES.md / pnpm-lock.yaml / CI workflow）
4. **熔断单实例约束**：§4.0.4 + D-16 明确"本期单实例运行"；多实例水平扩展须把熔断 / advisory lock 协调状态外移到 Redis 或 DB，列入后续优化

🟡 **警告级（4 项）**
5. **storageKey 命名统一**：全部改为点分小写 `.v1`；新增 CI grep 守门规则
6. **§3.0.5 audit log 补全**：新增 `video.reopen` / `video.refetch_sources` 写入位点；前台 `feedback/playback` 不入 admin_audit_log 注脚
7. **CHG-SN-4-09 编号空置协议**：明确编号空置不复用，M-SN-5 拆分实装首张卡新开 CHG-SN-5-XX
8. **§11.5 收口准入第 9 项**：增加"全 admin 列表 visual diff 无回归"以闭合 §9 风险缓解

🟢 **提示级（4 项）**
9. **§7 DecisionCard 重复行合并**：mock→真实 + 上移 admin-ui 合并为一行
10. **§3.0.6 publish 并发条件加固**：`WHERE is_published = false AND review_status = 'approved'`
11. **§5.0.5 i18n 项目定位注脚**：明确后台 zh-CN-only 可接受，t() 调用为后续多语言留空间
12. **§7.1 useTableQuery `tab` 来源补上下文**：示例代码增加 useSearchParams 注释 + storageKey 命名修正

**人工 sign-off：** 已取得（用户审核结论 + "做 v1.2 minor 修订"指令）。

**arch-reviewer 评审：** 仅文本 minor 修订，无代码改动，无新决策；落地任务卡（CHG-SN-4-03 / -04 / -10）仍按 v1.1 既定**强制走 `arch-reviewer` (claude-opus-4-7)**。

---

### v1.1 — 2026-05-01

**性质：** plan §0 重大修订（范围补漏 + 共性约束补齐 + 缺失 milestone 收口段补建）；按 `docs/server_next_plan_20260427.md` §5.2 BLOCKER 第 12 条版本协议处理。

**触发：** 主循环对照 `docs/server_next_plan_20260427.md` §6 M-SN-4（v2.5）+ CLAUDE.md + workflow-rules.md 的缺漏盘点，用户采纳全部 5 项推荐决策（拆分入口推迟 M-SN-5 / VideoEditDrawer 纳入 M-SN-4 / apps/worker 独立 / useTableQuery 复用 / 已发布历史 Tab 不渲染）。

**修订项：**

1. §0 增加 v1.1 修订摘要 + 上游真源链接
2. §1 决策表追加 D-13 ～ D-18（状态保留型筛选选型 / admin-ui 共享组件下沉清单 / 拆分入口推迟 / worker 部署归属 / player_feedback 客户端实装位置 / admin_audit_log 前置补建）
3. §2 新增 Migration 059 review_source + Migration 060 admin_audit_log；新增 §2.10 编号占用与回滚约束 + §2.11 architecture.md 同步约束
4. §3 新增 §3.0 七项共性约束（端点归属 / ApiResponse 信封 / errorCode 枚举 / RBAC 矩阵 / audit log 写入位点 / 并发保护 / 类型同步）
5. §4 新增 §4.0 worker 部署归属与基础设施（apps/worker 创建 / 调度配置 / advisory lock / 站点熔断 / pino 可观测）
6. §5 新增 §5.0 六项前端共性约束（状态保留型筛选 / 键盘流作用域 / 失败回滚 / LoadingState/ErrorState 接线 / i18n key 规范 / a11y）
7. §6 显示补全表追加 BarSignal 双柱图行
8. §7 mock→真实 API 接入清单标注下沉去向；新增 §7.1 useTableQuery 接入策略 + §7.2 visual baseline 截图清单
9. §8 完全重写为任务卡映射表（CHG-SN-4-03 ～ -10 + DEBT-SN-3-A），含建议模型 / 强制子代理 / 必跑命令 / 顺序与并行轨道 / 分支与 commit trailer 协议
10. §9 风险表追加 7 项（v1.1 标注）
11. §10 不在本期表追加 D-15 拆分入口推迟登记 + 已发布历史 Tab 不渲染
12. 新增 §11 Milestone 收口（e2e 4 用例 + 状态保留 5 步压力测试 + arch-reviewer 评级模板 + DEBT-SN-3-A 关闭确认 + 收口准入条件 8 项）
13. 新增 §12 修订日志

**人工 sign-off：** 已取得（用户指令"采纳推荐，起草修订后 plan"）。

**arch-reviewer 评审：** 本次修订为 plan 文档自身，无代码改动；按 `docs/server_next_plan_20260427.md` §0 plan 版本协议，本范围属"补漏 + 共性约束澄清"而非新功能决策，参照 v2.5 修订先例由用户直接指令 sign-off 代替子代理评审；具体落地时 CHG-SN-4-03 / -04 / -10 三张卡仍**强制走 `arch-reviewer` (claude-opus-4-7)**。

---

*本文档（**v1.4**）为 M-SN-4 开发真源，代码改动须对照本文档验证覆盖度。任务卡入队前请先核对 §8 任务卡映射 + §11 收口准入条件。*
