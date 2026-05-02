# M-SN-4 内容审核台上线实施方案

> 版本：1.0  
> 日期：2026-05-01  
> 作者：Engineering（claude-sonnet-4-6 辅助生成）  
> 状态：待工程确认 → 实施  
> 依赖：CHG-SN-4-01（SplitPane）、CHG-SN-4-02（ModerationConsole mock）均已落地  

---

## 0. 方案范围

本文档覆盖从视觉原型到生产可用的完整实施路径，包括：

- 数据库 schema 补全（Migrations 052–058）
- 后端 API 新增与修改
- 后台 Worker 设计（信号验证 + 分辨率采集）
- 前端 mock → 真实 API 接入
- 各操作的交互流程与界面变化
- 实施顺序与风险控制

**不在本期范围：** 定时发布调度器、视频拆分功能实现、WebSocket 实时推送。

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

---

## 2. 数据库迁移方案（Migrations 052–058）

### 2.1 Migration 052 — 状态机扩展（退回审核）

**目的：** 解除"退回审核"的状态机 BLOCKER，允许已暂存视频退回待审核队列。

```sql
-- 052_state_machine_add_staging_revert.sql
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

### 2.2 Migration 053 — 线路级信号列

**目的：** `video_sources` 新增每条线路独立的探测/渲染状态与延迟，取代仅有 `is_active` 的粗粒度状态。

```sql
-- 053_video_sources_signal_columns.sql
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

### 2.3 Migration 054 — 视频补充字段

**目的：** 新增 `staff_note`（审核员过程备注）和 `review_label_key`（预设拒绝标签键值）。

```sql
-- 054_videos_moderation_fields.sql
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

### 2.4 Migration 055 — 预设审核标签表

**目的：** 建立结构化的拒绝标签体系，支持审核数据分析。

```sql
-- 055_review_labels.sql
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

### 2.5 Migration 056 — 线路显示名（crawler_sites 扩展）

**目的：** 为 `crawler_sites` 新增用户可见别名，与 admin 运维名称分离。

```sql
-- 056_crawler_sites_user_label.sql
ALTER TABLE crawler_sites
  ADD COLUMN IF NOT EXISTS user_label TEXT;

COMMENT ON COLUMN crawler_sites.user_label
  IS '面向前端用户的线路别名（如"主线"/"超清线"/"备用线"）；NULL 时降级到 display_name';
```

---

### 2.6 Migration 057 — source_health_events 扩展

**目的：** 关联单条线路，支持"证据"面板按线路查询健康历史。

```sql
-- 057_source_health_events_line_detail.sql
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

### 2.7 Migration 058 — 视频分辨率检测字段

**目的：** 区分"采集声明分辨率"与"实测分辨率"，实测值优先。

```sql
-- 058_video_sources_resolution_detection.sql
ALTER TABLE video_sources
  ADD COLUMN IF NOT EXISTS quality_detected TEXT
    CHECK (quality_detected IN ('4K', '2K', '1080P', '720P', '480P', '360P', '240P')),
  ADD COLUMN IF NOT EXISTS quality_source TEXT
    CHECK (quality_source IN ('crawler', 'manifest_parse', 'player_feedback', 'admin_review'))
    DEFAULT 'crawler',
  ADD COLUMN IF NOT EXISTS resolution_width  INT,   -- 实测像素宽
  ADD COLUMN IF NOT EXISTS resolution_height INT,   -- 实测像素高
  ADD COLUMN IF NOT EXISTS detected_at       TIMESTAMPTZ;

COMMENT ON COLUMN video_sources.quality_detected
  IS '实测分辨率档位；前端展示优先级：quality_detected > quality > NULL';
COMMENT ON COLUMN video_sources.quality_source
  IS '分辨率来源：crawler=采集时抓取 / manifest_parse=后台解析 / player_feedback=播放回报 / admin_review=审核时获取';
COMMENT ON COLUMN video_sources.resolution_width
  IS '实测视频宽度（像素），用于精确分辨率判断（如 1920×1080 vs 1280×720）';

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

## 3. 后端 API 方案

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

#### POST /api/v1/feedback/playback

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

---

## 7. 前端 Mock → 真实 API 接入清单

| 文件 | 当前状态 | 接入目标 |
|------|---------|---------|
| `ModerationConsole.tsx` | MOCK_VIDEOS + console.log | pending-queue API + 操作 API |
| `ModListRow.tsx` | MockVideo 类型 | VideoQueueRow 类型（含 probe/render 真实数据） |
| `PendingCenter.tsx` | console.log 操作 | 无 API 改动（操作由 ModerationConsole 传入） |
| `LinesPanel.tsx` | MOCK_LINES | GET /admin/videos/:id/sources + toggle/disable-dead API |
| `EpisodeSelector.tsx` | 纯 UI | 无 API 接入（集数来自 video.episode_count） |
| `DecisionCard.tsx` | probe/render mock | 使用真实聚合信号，staff_note 信息条新增 |
| `StagingTabContent.tsx` | MOCK_STAGING_VIDEOS | GET /admin/staging；退回/发布接入 |
| `RejectedTabContent.tsx` | MOCK_REJECTED_VIDEOS | GET /admin/videos?reviewStatus=rejected；移除删除按钮 |
| 新增：`RejectModal.tsx` | — | 预设标签选择 Modal |
| 新增：`LineHealthDrawer.tsx` | — | 线路证据展开面板 |
| 新增：`StaffNoteBar.tsx` | — | amber 备注信息条 |

---

## 8. 实施顺序与里程碑

### Week 1：DB 基础层

```
Day 1-2: 052（状态机）+ 053（线路信号）
  → 测试 staging_revert 状态转换
  → 验证线路 probe/render 列回填正确

Day 3-4: 054（staff_note + review_label_key）+ 055（review_labels 种子数据）

Day 5: 056（user_label）+ 057（health events）+ 058（分辨率检测）
  → 运行全量迁移，验证索引

交付物：所有 DB 字段就绪；types 更新；API 类型同步
```

### Week 2：后端 API 层

```
Day 1-2:
  pending-queue 端点（cursor 分页，含 todayStats）
  reject-labeled 端点
  staff-note PATCH 端点
  review-labels GET 端点

Day 3-4:
  staging/:id/revert 端点
  sources/:sourceId PATCH 端点
  sources/disable-dead 端点
  line-health/:sourceId GET 端点

Day 5:
  POST /api/v1/feedback/playback 端点
  已有端点修改（review + batch-reject 加 labelKey）
  所有新端点 unit test

交付物：完整 API 层；Postman/curl 可验证所有操作
```

### Week 3：Worker 层

```
Day 1-2: SourceHealthWorker Level 1 完整实现
  定时触发（6h cron）
  probe_status 写回 + source_health_events 记录
  视频级 source_check_status 聚合

Day 3-4: Level 2 Playability + 分辨率采集
  m3u8/mp4/dash manifest parse
  resolution_width/height/quality_detected 写回
  热门视频 vs 普通视频分策略

Day 5: 用户反馈触发 Level 2 的逻辑
  /feedback/playback 速率限制
  连续 3 次失败触发 Level 2

交付物：Worker 可独立运行；DB 中 probe/render 数据开始填充
```

### Week 4：前端接入

```
Day 1-2:
  ModerationConsole 接入 pending-queue API（虚拟滚动）
  Gmail 式导航（approve/reject/skip 流）
  RejectModal 组件（预设标签）

Day 3-4:
  LinesPanel 接入真实源数据
  LineHealthDrawer（证据展开）
  StaffNoteBar + inline 编辑
  DisableDeadButton 替换 DeleteDeadButton

Day 5:
  StagingTabContent 真实数据接入 + 退回审核
  RejectedTabContent 真实数据接入 + 移除删除按钮
  整体 E2E 走查（审核流程、暂存流程、拒绝流程）

交付物：审核台全流程可用；mock-data.ts 仅用于 unit tests
```

---

## 9. 风险与注意事项

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|---------|
| migration 052 影响现有状态机 trigger | 中 | 高 | 先在 staging 环境验证所有已有状态路径 |
| Level 2 验证对源站造成过多请求 | 中 | 中 | 严格速率限制；同一源站同时最多 2 并发 |
| cursor 分页与队列实时变化（新入库视频插入头部）导致重复 | 低 | 低 | cursor 基于 `created_at + id` 稳定排序；新入库视频在当前批次不重复 |
| worker 分辨率采集失败率高（源站反爬）| 高 | 低 | 失败不影响播放；降级到 quality 字段；记录错误 |
| 审核员批量 skip 后队列显示混乱 | 低 | 低 | skip 状态仅会话内有效；刷新后恢复原始顺序 |

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

---

*本文档为 M-SN-4 开发真源，代码改动须对照本文档验证覆盖度。*
