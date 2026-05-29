# 视频线路别名体系设计方案

**状态**：草案（待 CHG-SN-8 完成后评估实施）
**日期**：2026-05-25
**作者**：讨论稿

---

## 背景与问题

Resovo 从多个源站爬取视频链接，每个源站提供若干条线路（`source_name` 如 `线路1`、`主线`、`SUB云`）。直接展示这些技术名存在三个问题：

1. **不可读**：`bfzy_线路2` 对用户无意义
2. **大量重名**：多个站点都有 `线路1`，在 Admin 界面区分困难
3. **前台线路顺序未优化**：可用线路常在靠后位置，用户必须手动切换

**目标**：设计一套「稳定代号 + 动态排序 + 可主题化标签」三层体系，兼顾用户体验、运维效率与扩展性。

---

## 现有架构基础

| 层 | 文件 | 关键字段 |
|---|---|---|
| DB 别名表 | `apps/api/src/db/migrations/063_source_line_aliases.sql` | `(source_site_key, source_name) → display_name` |
| 类型 | `packages/types/src/sources-matrix.types.ts` | `SourceLineAlias` |
| 服务 | `apps/api/src/services/SourcesMatrixService.ts` | `upsertLineAlias()` |
| 显示工具 | `apps/web-next/src/lib/line-display-name.ts` | `buildLineDisplayName()` |
| 健康字段 | Migration 054 / 059 | `probe_status`, `render_status`, `latency_ms`, `quality_detected` |

**关键约束**：ADR-114-NEGATED 确认复合键 `(site_key, source_name)` 是线路唯一标识，跨站不合并。

---

## 三层命名体系总览

```
┌──────────────────────┐   ┌──────────────────────┐   ┌──────────────────────┐
│  Layer C（用户侧）    │   │  Layer B（运维侧）    │   │  Layer A（排序引擎） │
│  主题标签（位置映射）│   │  山名代号（永久绑定） │   │  effective_score     │
│                      │   │                      │   │                      │
│  · 不与具体线路绑定  │   │  · 永久绑定线路      │   │  · 质量 + 健康 + 延迟│
│  · 多语言 / 可换主题 │   │  · 仅运维可见        │   │  · 决定展示顺序      │
│  · 可用户自定义      │   │  · 日志追溯 / 告警   │   │  · 后端计算          │
└──────────────────────┘   └──────────────────────┘   └──────────────────────┘
```

---

## Layer A：排序算法（effective_score）

后端在 `SourceService.listSources()` 中计算，返回已排序列表。

```
effective_score = 0.50 × health_score
                + 0.30 × quality_score
                + 0.15 × latency_score
                + 0.05 × priority_bonus
```

### health_score（双轨信号综合分）

```
probe_map:  dead→0.0, pending→0.3, partial→0.6, ok→1.0
render_map: dead→0.0, pending→0.3, partial→0.6, ok→1.0

health_score = probe_map(probe_status) × 0.4
             + render_map(render_status) × 0.6
```

render 权重更高：探测通过但不可播比单纯探测失败更影响用户体验。

### quality_score

```
优先使用 quality_detected（实测值），NULL 时回落 quality 字段，再 NULL 取 0.40 中性分

4K  → 1.00   2K   → 0.85   1080P → 0.70   720P → 0.50
480P → 0.30   360P → 0.15   240P  → 0.05   NULL → 0.40
```

### latency_score

```
NULL    → 0.50（未知，中性）
≤200ms → 1.00   ≤500ms  → 0.70   ≤1000ms → 0.50
≤2000ms → 0.30  >2000ms → 0.10
```

### priority_bonus

`source_line_aliases.priority`（待新增 SMALLINT 字段，0–100），归一化到 0.0–1.0。
运维手工微调，不覆盖健康评分的主导作用。

---

## Layer B：运维侧山名代号（静态绑定）

每条 `(source_site_key, source_name)` 永久绑定一个山名，存入 `source_line_aliases.codename`（待新增字段）。

**用途**：运维日志、告警、沟通统一使用代号，无需记忆技术标识。
> 示例："峨眉线今日 probe 全挂，需触发 reprobe"

### 命名字库：中国名山（50 个）

```
五岳：  泰山  华山  衡山  嵩山  恒山
佛道：  峨眉  武当  普陀  九华  五台  龙虎  齐云  武夷
西部：  昆仑  天山  祁连  贺兰  六盘  太白  终南  秦岭
东部：  崂山  蒙山  沂山  天目  莫干  雁荡  天台  琅琊
南北：  太行  燕山  长白  大青  阴山  大别  桐柏  梵净
南方：  黄山  庐山  三清  丹霞  罗浮  鼎湖  天柱  缙云
其他：  崆峒  麦积  鸡公  大明  天门  南山  云台  神农
```

50 个名字覆盖预估线路总量（约 20 站 × 平均 3 条 = 60 条；字库可追加扩展）。

### 分配规则

- 管理员在 `/admin/source-line-aliases` 手工填写（含字库下拉，标注"可用/已占用"）
- 自动建议：新线路首次出现时提示"下一可用代号"（按字库顺序，跳过已占用和冷却中的）
- **一旦分配，永不更改**（线路失效后代号仍保留在案）

### 代号生命周期与回收

```
分配 → 正常使用 → retired_at 打时间戳 → 90 天冷却 → 可用池再分配
```

| 退役触发 | 条件 |
|---|---|
| 手动 | 运维主动操作 |
| 自动 | `probe_status = dead AND render_status = dead` 持续 180 天 |

冷却期 90 天：防止日志/书签混淆已退役代号。

**DB 字段**：`source_line_aliases.retired_at TIMESTAMPTZ NULL`
- `NULL` = 在用
- 非 NULL + 距今 > 90 天 = 进入可用池

---

## Layer C：用户侧主题标签系统（纯前端）

### 设计原则

- 标签**只代表排序位置**，不代表具体线路身份
- 换主题 = 换"皮肤"，排序和可用性不变
- 多语言：先覆盖简体中文、英文；架构支持任意扩展
- **完全在前端处理**，后端只负责返回排好序的列表

### 标签赋值规则

```
后端返回：已按 effective_score 排序的线路列表

前端赋标签：
  index 0 → theme.labels[0]              ← 最优可用线路
  index 1 → theme.labels[1]              ← 次优可用线路
  index n → theme.labels[n]              ← 超出主题长度时：
          ?? fallback(n)                    "线路{n+1}" / "Route {n+1}"
  dead    → theme.deadLabel               ← 健康分 = 0，排到末尾
```

### 极端情况处理

| 情况 | 处理 |
|---|---|
| **0 条线路** | 不渲染栏，展示"暂无可用线路 / No sources available" |
| **1 条线路** | 不渲染线路标签，只展示画质档位（仅 1 条无需选择） |
| **全部 dead** | 所有按钮置灰 + deadLabel，保留"尝试播放 / Try anyway"兜底 |
| **> 主题长度** | `线路{n} / Route {n}` 数字兜底，永远不缺位 |

---

### 预置主题

#### 简体中文

**主题：节气**（推荐默认）

24 个节气，中国全年龄段耳熟能详，覆盖几乎所有极端情况，且无主次含义。

```
立春  雨水  惊蛰  春分  清明  谷雨
立夏  小满  芒种  夏至  小暑  大暑
立秋  处暑  白露  秋分  寒露  霜降
立冬  小雪  大雪  冬至  小寒  大寒

deadLabel：已断
fallback：线路{n}（超过 24 条时）
```

**主题：星宿**（可选）

二十八宿，单字，显示紧凑，适合天文/国风偏好用户。

```
角  亢  氐  房  心  尾  箕
斗  牛  女  虚  危  室  壁
奎  娄  胃  昴  毕  觜  参
井  鬼  柳  星  张  翼  轸

deadLabel：暗
fallback：线路{n}
```

**主题：数字**（极简备选）

```
一  二  三  四  五  六  七  八  九  十

deadLabel：断
fallback：线路{n}
```

---

#### English

**Theme: NATO Phonetic**（推荐默认）

26 letters, universally recognized across tech, gaming, and professional communities.

```
Alpha   Bravo   Charlie  Delta   Echo    Foxtrot
Golf    Hotel   India    Juliet  Kilo    Lima
Mike    November Oscar   Papa    Quebec  Romeo
Sierra  Tango   Uniform Victor  Whiskey X-ray
Yankee  Zulu

deadLabel: Offline
fallback: Route {n}
```

**Theme: Planets**（可选）

8 classic planets. Perfect for typical 3–5 route scenarios.

```
Mercury  Venus  Mars  Jupiter  Saturn  Uranus  Neptune  Pluto

deadLabel: Dark
fallback: Route {n}
```

**Theme: Colors**（可选）

Elegant, minimal; best for 4–6 routes.

```
Crimson  Amber  Jade  Azure  Indigo  Violet  Onyx  Pearl

deadLabel: Dim
fallback: Route {n}
```

---

### 用户自定义主题

允许用户在播放器设置中输入自定义名称列表。

```
存储位置：localStorage（MVP）
  key: resovo_route_theme
  value: { type: 'custom', labels: ['自选1', '自选2', ...], deadLabel: '断了' }

约束：
  - labels.length >= 1
  - labels.length <= 30
  - 每个名字 <= 10 字符
  - deadLabel 可选（省略时回退到系统默认）

UI 入口：播放器设置面板 → "线路标签主题" → 下拉选主题 或 "自定义…"
```

**进阶（后期可选）**：登录用户的自定义主题同步至 `users.preferences` JSON 字段，跨设备生效。

---

## 前台展示示例

```
节气主题（3 条线路 + 1 条失效）：
  [● 清明 · 1080P]  [○ 谷雨 · 720P]  [○ 立夏 · 720P]  [○ 已断]

NATO 主题（同上）：
  [● Alpha · 1080P]  [○ Bravo · 720P]  [○ Charlie · 720P]  [○ Offline]

全部失效：
  [○ 已断]  [○ 已断]  [○ 已断]   + 横幅"所有线路当前不可用"

只有 1 条线路：
  （不显示线路栏，仅展示画质标签）

用户自定义：
  [● 极速 · 1080P]  [○ 备用 · 720P]  [○ 测试]
```

---

## 实施路线图

```
Phase 1（无 schema 变更，可最快上线）
  ├── SourceService.listSources() 加入 effectiveScore 计算 + 排序
  ├── 前端 SourceBar 按主题赋标签（默认节气 / NATO）
  └── 用户侧效果立即改善：最优线路始终排第一

Phase 2（主题切换 UX）
  ├── 播放器设置面板增加主题选择器
  ├── localStorage 持久化用户选择
  └── 用户自定义名称列表入口

Phase 3（运维代号，需 DB 变更）
  ├── Migration 064：source_line_aliases 新增 codename / priority / retired_at
  ├── Admin UI：codename 列 + 字库下拉
  ├── priority 调整
  └── 退役流程端点 + UI

Phase 4（跨设备同步，可选）
  └── 自定义主题同步至 users.preferences JSON 字段
```

---

## 待实施的 DB 变更（Phase 3 参考）

```sql
-- Migration 064（草稿）
ALTER TABLE source_line_aliases
  ADD COLUMN codename   VARCHAR(20)  NULL,
  ADD COLUMN priority   SMALLINT     NOT NULL DEFAULT 0,
  ADD COLUMN retired_at TIMESTAMPTZ  NULL;

-- 活跃代号唯一约束（退役代号释放后可复用）
CREATE UNIQUE INDEX idx_source_line_aliases_codename_active
  ON source_line_aliases (codename)
  WHERE codename IS NOT NULL AND retired_at IS NULL;
```

---

## 待修改的代码文件（Phase 1–3 参考）

| 文件 | 变更内容 |
|---|---|
| `apps/api/src/services/SourceService.ts` | `listSources()` 增加 `effectiveScore` 计算 + 排序 |
| `apps/web-next/src/lib/line-display-name.ts` | 新增 `RouteTheme` 类型 + 内置主题常量 + `applyThemeLabels()` |
| `apps/web-next/src/components/player/SourceBar.tsx` | 读取主题 → 调用 `applyThemeLabels()` → 渲染 `themeLabel · quality` |
| `packages/types/src/sources-matrix.types.ts` | `SourceLineAlias` 增加 `codename`, `priority`, `retiredAt` |
| `apps/api/src/routes/admin/sources-matrix.ts` | `PUT` 端点接受新字段；新增退役端点 |
| `apps/api/src/db/migrations/064_*.sql` | 新增 3 字段 + 唯一索引 |
