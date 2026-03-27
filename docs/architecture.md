# Resovo（流光） — 技术架构参考

> status: active
> owner: @engineering
> scope: system architecture and module boundaries
> source_of_truth: yes
> supersedes: none
> superseded_by: none
> last_reviewed: 2026-03-27
>
> 本文件是架构的唯一权威来源。所有与架构相关的代码决策必须与本文件保持一致。
> 若代码实现与本文件有出入，以本文件为准并修改代码。

---

## 项目目录结构

```
resovo/
├── CLAUDE.md                        # Claude Code 工作总纲
├── docs/                            # 所有文档（不含业务代码）
│   ├── architecture.md
│   ├── decisions.md
│   ├── tasks.md
│   ├── roadmap.md
│   ├── changelog.md
│   └── rules/
│       ├── code-style.md
│       ├── api-rules.md
│       ├── db-rules.md
│       └── ui-rules.md
├── src/
│   ├── app/                         # Next.js App Router
│   │   ├── [locale]/                # 国际化路由包装
│   │   │   ├── (home)/page.tsx      # 首页
│   │   │   ├── search/page.tsx      # 搜索页
│   │   │   ├── watch/[id]/page.tsx  # 播放页
│   │   │   ├── movie/[slug]/page.tsx
│   │   │   ├── anime/[slug]/page.tsx
│   │   │   ├── collection/[slug]/page.tsx
│   │   │   └── playlist/[id]/page.tsx
│   │   └── api/                     # Next.js Route Handlers（仅 BFF 层）
│   ├── components/
│   │   ├── player/                  # 播放器相关组件
│   │   │   ├── PlayerShell.tsx      # 播放器容器
│   │   │   ├── ControlBar.tsx       # 控制栏
│   │   │   ├── EpisodeOverlay.tsx   # 选集浮层
│   │   │   ├── CCPanel.tsx          # 字幕面板
│   │   │   ├── SpeedPanel.tsx       # 倍速面板
│   │   │   └── DanmakuBar.tsx       # 弹幕条
│   │   ├── search/
│   │   │   ├── FilterBar.tsx        # 顶部筛选栏
│   │   │   ├── ResultCard.tsx       # 搜索结果卡片
│   │   │   └── MetaChip.tsx         # 可点击 meta chip
│   │   ├── video/
│   │   │   ├── VideoCard.tsx        # 视频卡片（首页/推荐用）
│   │   │   ├── VideoMeta.tsx        # 视频详情 meta 区域
│   │   │   └── HeroBanner.tsx       # 首页 Hero
│   │   └── ui/                      # 通用 UI 原子组件
│   │       ├── Button.tsx
│   │       ├── Chip.tsx
│   │       ├── ThemeToggle.tsx
│   │       └── ...
│   ├── api/                         # Fastify 后端（独立进程）
│   │   ├── routes/
│   │   │   ├── auth.ts
│   │   │   ├── videos.ts
│   │   │   ├── search.ts
│   │   │   ├── sources.ts
│   │   │   ├── subtitles.ts
│   │   │   ├── danmaku.ts
│   │   │   ├── comments.ts
│   │   │   ├── users.ts
│   │   │   ├── lists.ts
│   │   │   └── admin/
│   │   ├── services/                # 业务逻辑层
│   │   │   ├── VideoService.ts
│   │   │   ├── SearchService.ts
│   │   │   ├── UserService.ts
│   │   │   ├── SourceService.ts
│   │   │   └── CrawlerService.ts
│   │   ├── db/                      # 数据库查询层
│   │   │   ├── queries/             # 原生 SQL 查询函数
│   │   │   └── migrations/          # 数据库迁移文件
│   │   └── lib/
│   │       ├── postgres.ts          # PG 连接池
│   │       ├── redis.ts             # Redis 客户端
│   │       └── elasticsearch.ts     # ES 客户端
│   ├── stores/                      # Zustand 状态
│   │   ├── playerStore.ts           # 播放器状态
│   │   └── themeStore.ts            # 主题状态
│   └── lib/
│       ├── api-client.ts            # 前端 API 请求封装
│       └── constants.ts
├── public/
│   └── locales/                     # i18n 翻译文件
│       ├── en.json
│       ├── zh-CN.json
│       └── ja.json
└── tests/
    ├── unit/
    └── e2e/
```

---

## 核心数据库表结构

### users
| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID PK | gen_random_uuid() |
| username | TEXT UNIQUE | 3-20字符 |
| email | TEXT UNIQUE | 登录用 |
| password_hash | TEXT | bcrypt |
| role | TEXT | guest/user/moderator/admin |
| locale | TEXT | 默认 en，如 zh-CN |
| created_at | TIMESTAMPTZ | |

### videos
| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID PK | |
| short_id | CHAR(8) UNIQUE | nanoid，URL 使用 |
| slug | TEXT | SEO 路径段 |
| title | TEXT | 中文标题 |
| title_en | TEXT | 英文原名 |
| description | TEXT | |
| cover_url | TEXT | 外链 URL（爬虫采集的源站封面，不下载到 R2，见 ADR-009） |
| type | TEXT | 内容形式（VideoType 11种），见下方枚举；Migration 019（CHG-176）重建 |
| source_content_type | TEXT | 爬虫原样写入的源站类型字符串，用于溯源与重分类 |
| normalized_type | TEXT | 平台规范化分类，可比 type 更细，供搜索/推荐使用 |
| content_format | TEXT | `movie` / `episodic` / `collection` / `clip` |
| episode_pattern | TEXT | `single` / `multi` / `ongoing` / `unknown` |
| source_category | TEXT | 爬虫原始分类字符串（直接来自源站 type_name，不做枚举约束） |
| genre | TEXT | 内容题材（VideoGenre 15种）：action/comedy/romance/thriller/horror/sci_fi/fantasy/history/crime/mystery/war/family/biography/martial_arts/other；初始 NULL，由管理员策展填写 |
| rating | FLOAT | 0-10 |
| year | INT | |
| country | TEXT | JP/US/CN 等 |
| episode_count | INT | 默认 1 |
| status | TEXT | ongoing/completed |
| director | TEXT[] | 导演列表 |
| cast | TEXT[] | 演员/声优列表 |
| writers | TEXT[] | 编剧列表 |
| douban_id | VARCHAR(20) | 豆瓣 ID，nullable；CHG-23 migration 003 |
| is_published | BOOLEAN | **deprecated**，保留作兼容字段，由 service 层与 visibility_status 同步写入，见 ADR-018 |
| review_status | TEXT | `pending_review` / `approved` / `rejected` / `blocked`；默认 `pending_review` |
| visibility_status | TEXT | `public` / `hidden` / `internal` / `blocked`；主可见性控制字段，默认 `internal`；替代 `is_published` |
| review_reason | TEXT | 审核备注（拒绝/封锁原因） |
| review_source | TEXT | `system` / `ai` / `manual` |
| reviewed_by | UUID FK → users | 审核操作人 |
| reviewed_at | TIMESTAMPTZ | 审核时间 |
| needs_manual_review | BOOLEAN | 是否需要人工复核，默认 false |
| created_at | TIMESTAMPTZ | |

### video_sources
| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID PK | |
| video_id | UUID FK → videos | |
| season_number | INT NOT NULL DEFAULT 1 | 季号；电影/单集内容 = 1，见 ADR-016 |
| episode_number | INT NOT NULL DEFAULT 1 | 集号；电影/单集内容 = 1，不再使用 NULL（见 ADR-016） |
| source_url | TEXT | 第三方直链 |
| source_name | TEXT | 如"线路1" |
| quality | TEXT | 1080P/720P 等 |
| is_active | BOOLEAN | 爬虫维护 |
| submitted_by | UUID FK → users | NULL 表示爬虫 |
| last_checked | TIMESTAMPTZ | |

### subtitles
| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID PK | |
| video_id | UUID FK → videos | |
| episode_number | INT | |
| language | TEXT | BCP 47，如 zh-CN |
| file_url | TEXT | R2 存储 URL |
| format | TEXT | vtt/srt/ass |
| uploaded_by | UUID FK → users | |
| is_verified | BOOLEAN | 版主审核 |
| created_at | TIMESTAMPTZ | |

### lists（播放列表 & 片单）
| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID PK | |
| short_id | CHAR(8) UNIQUE | |
| owner_id | UUID FK → users | |
| type | TEXT | playlist/collection |
| title | TEXT | |
| description | TEXT | |
| cover_url | TEXT | |
| visibility | TEXT | public/private/unlisted |
| item_count | INT | 冗余计数 |
| like_count | INT | 冗余计数 |
| view_count | INT | 冗余计数 |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

### list_items
| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID PK | |
| list_id | UUID FK → lists | |
| video_id | UUID FK → videos | |
| position | INT | 拖拽排序 |
| added_at | TIMESTAMPTZ | |

### danmaku
| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID PK | |
| video_id | UUID FK → videos | |
| user_id | UUID FK → users | |
| episode_number | INT | |
| time_seconds | INT | 出现时间点 |
| content | TEXT | |
| color | CHAR(7) | 默认 #ffffff |
| type | TEXT | scroll/top/bottom |
| created_at | TIMESTAMPTZ | |

### crawler_tasks
| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID PK | |
| source_site | TEXT | |
| target_url | TEXT | |
| status | TEXT | pending/running/done/failed |
| retry_count | INT | 默认 0，上限 3 |
| result | JSONB | |
| scheduled_at | TIMESTAMPTZ | |
| finished_at | TIMESTAMPTZ | |

---

## API Base URL 与版本

- 后端 API：`https://api.resovo.tv/v1`
- 所有响应格式：JSON
- 认证：`Authorization: Bearer <access_token>`
- 错误格式：`{ "error": { "code": "...", "message": "...", "status": 4xx } }`

---

## 模块边界（严格遵守）

- **前端**不直接查询数据库，所有数据通过 API 获取
- **前端**不包含任何业务逻辑，只做渲染和状态管理
- **API 路由层**只做参数验证和响应格式化，业务逻辑放 `services/`
- **services/**不直接拼 SQL，数据库操作放 `db/queries/`
- **爬虫任务**通过 Bull 队列异步执行，不在 API 请求生命周期内运行

---

## 状态所有权表（State Ownership）

> AI 修改任何组件前必须查阅此表。
> 每个状态字段只能由"写入方"修改，其他组件只读。
> 违反此规则会导致跨组件状态冲突。

### playerStore

| 状态字段 | 类型 | 唯一写入方 | 允许读取 |
|---------|------|-----------|---------|
| `isPlaying` | boolean | `VideoPlayer` 组件 | 所有播放器子组件 |
| `currentTime` | number | `VideoPlayer` 组件 | `ControlBar`、`DanmakuBar` |
| `duration` | number | `VideoPlayer` 组件 | `ControlBar` |
| `volume` | number | `ControlBar` | `VideoPlayer` |
| `isMuted` | boolean | `ControlBar` | `VideoPlayer` |
| `speed` | number | `SpeedPanel`（通过 `ControlBar`） | `VideoPlayer` |
| `currentEpisode` | number \| null | `EpisodeOverlay`、`ControlBar` | 所有播放器子组件 |
| `currentSource` | VideoSource \| null | `ControlBar`（线路选择） | `VideoPlayer` |
| `availableSources` | VideoSource[] | `PlayerShell`（数据加载） | `ControlBar` |
| `activeSubtitle` | Subtitle \| null | `CCPanel`（通过 `ControlBar`） | `VideoPlayer` |
| `availableSubtitles` | Subtitle[] | `PlayerShell`（数据加载） | `CCPanel` |
| `theaterMode` | boolean | `ControlBar` 唯一（仅桌面端） | `PlayerShell` |
| `speedPanelOpen` | boolean | `ControlBar` 唯一 | `usePlayerShortcuts`（键盘状态机） |
| `episodeOverlayOpen` | boolean | `EpisodeOverlay`、`ControlBar` | `usePlayerShortcuts`（键盘状态机） |
| `resumePromptVisible` | boolean | `VideoPlayer`（进度检测后） | `ResumePrompt` 组件 |
| `resumeFromSeconds` | number \| null | `VideoPlayer`（读取存储后） | `ResumePrompt` 组件 |
| `danmakuEnabled` | boolean | `DanmakuBar` 唯一 | `VideoPlayer` |
| `danmakuOpacity` | number | `DanmakuBar` 唯一 | `VideoPlayer` |
| `danmakuFontSize` | number | `DanmakuBar` 唯一 | `VideoPlayer` |

### authStore

| 状态字段 | 类型 | 唯一写入方 | 允许读取 |
|---------|------|-----------|---------|
| `user` | User \| null | `authStore.login`、`authStore.logout` | 所有需要用户信息的组件 |
| `accessToken` | string \| null | `authStore`（含自动刷新） | `api-client.ts` 唯一 |

### themeStore

| 状态字段 | 类型 | 唯一写入方 | 允许读取 |
|---------|------|-----------|---------|
| `theme` | 'dark' \| 'light' \| 'system' | `ThemeToggle` 组件唯一 | 所有组件（只读） |

---

## 采集接口字段映射（苹果CMS → Resovo（流光） 数据库）

> CrawlerService 解析接口数据时必须严格按此映射表处理，不得自行猜测字段含义。

### 元数据映射（接口字段 → videos 表）

| 接口字段 | 数据库字段 | 类型转换 / 处理规则 |
|---------|-----------|-------------------|
| `vod_name` | `title` | 直接映射，trim 空白 |
| `vod_en` | `title_en` | 直接映射，可为空 |
| `vod_pic` | `cover_url` | 直接存外链 URL，不下载（ADR-009） |
| `type_name` | `category` | 标准化映射，见下方分类映射表 |
| `vod_year` | `year` | 转 INT，无效值存 NULL |
| `vod_area` | `country` | 标准化为 ISO 3166-1 代码，见下方地区映射表 |
| `vod_actor` | `cast` | 按 `,` 或 `、` 拆分为 TEXT[] |
| `vod_director` | `director` | 按 `,` 或 `、` 拆分为 TEXT[] |
| `vod_writer` | `writers` | 按 `,` 或 `、` 拆分为 TEXT[] |
| `vod_content` | `description` | 用 `striptags` 清理 HTML 标签 |
| `vod_remarks` | `status` | 含"完结"→`completed`，其余→`ongoing` |
| `type_name` | `type` | 见下方类型映射表 |
| `vod_id` | （不存 videos 表）| 存入 `crawler_tasks.result.source_vod_id`，用于增量更新对比 |

### 播放源映射（接口字段 → video_sources 表）

接口中播放源在 `vod_play_url` 字段（JSON 格式）或 `<dl><dd>` 节点（XML 格式）：

```
# 原始格式（单个线路）：
第01集$https://cdn.example.com/ep01.m3u8#第02集$https://cdn.example.com/ep02.m3u8

# 解析规则：
1. 按 # 拆分得到每集字符串
2. 按 $ 拆分得到 [集名, URL]
3. 从集名提取集数（正则：/(\d+)/），未提取到时默认 1
4. season_number 默认写 1（苹果CMS 接口无季字段）
5. 电影/单集（episode_count=1）：season_number=1, episode_number=1（不再使用 NULL，见 ADR-016）
```

| 解析结果 | 数据库字段 | 说明 |
|---------|-----------|------|
| 线路标识（flag 属性） | `source_name` | 如 "jsm3u8"、"heimuer" |
| 季号（默认 1，苹果CMS 接口通常无季字段） | `season_number` | INT NOT NULL DEFAULT 1，见 ADR-016 |
| 集数（从集名解析） | `episode_number` | INT NOT NULL DEFAULT 1；电影/单集写 1，不再使用 NULL，见 ADR-016 |
| m3u8/mp4 URL | `source_url` | 第三方直链（ADR-001） |
| URL 后缀判断 | `type` | `.m3u8`→`hls`，`.mp4`→`mp4` |

### 类型映射表（type_name → VideoType）— Migration 019 更新后

> `source_content_type` 存爬虫原始字符串；`type` 是内容形式枚举（11种）；`source_category` 存爬虫原始分类字符串；`genre` 是平台策展题材（15种，初始 NULL）。
> VideoType（内容形式）与 VideoGenre（内容题材）严格正交，同一词不同时出现在两个维度（见 `docs/db-rebuild-naming-plan.md`）。

| 接口值（`vod_type_name` / `type_name`） | `videos.type` | `videos.source_content_type` |
|----------------------------------------|--------------|------------------------------|
| 电影、Movie、film | `movie` | 原样写入 |
| 电视剧、连续剧、国产剧、美剧、韩剧、日剧、港剧、台剧 | `series` | 原样写入 |
| 动漫、卡通、动画、anime | `anime` | 原样写入 |
| 综艺、真人秀、晚会、脱口秀、游戏、电竞 | `variety` | 原样写入 |
| 短剧、微剧、竖屏剧 | `short` | 原样写入 |
| 纪录片、documentary | `documentary` | 原样写入 |
| 音乐、MV、演唱会 | `music` | 原样写入 |
| 体育、sports、赛事 | `sports` | 原样写入 |
| 新闻、资讯 | `news` | 原样写入 |
| 少儿、儿童节目 | `kids` | 原样写入 |
| 其他 / 未知 / 未匹配 | `other` | 原样写入 |

**未匹配规则**：凡 `type_name` 不在上表中的，`type` 写 `other`，`source_content_type` 保留原始值，供后续重分类。

### 地区映射表（vod_area → country）

| 接口值 | ISO 代码 |
|--------|---------|
| 中国大陆、大陆、国产、华语 | `CN` |
| 香港、港剧 | `HK` |
| 台湾 | `TW` |
| 日本、日剧 | `JP` |
| 韩国、韩剧 | `KR` |
| 美国、美剧 | `US` |
| 英国 | `GB` |
| 泰国 | `TH` |
| 其他 / 未知 | `NULL` |

### 去重规则

同一视频可能从多个资源站采集到，按以下规则去重：

1. **精确匹配**：`title` + `year` 完全相同 → 视为同一视频，只新增 `video_sources` 记录
2. **模糊匹配**：标题去掉标点和空格后相同 → 同上处理
3. **无法匹配**：新建 `videos` 记录

去重时以第一个采集到的资源站数据为准（元数据不覆盖），后续采集只追加播放源。

---

## 爬虫任务类型

| 任务名 | 队列 | 触发方式 | 说明 |
|--------|------|---------|------|
| `full-crawl` | `crawler-queue` | 手动 / 初始化时 | 全量采集，按分页遍历所有内容 |
| `incremental-crawl` | `crawler-queue` | 每日凌晨 2:00 | 增量采集，`?h=24` 只拉最近更新 |
| `verify-source` | `verify-queue` | 每日凌晨 4:00 | 验证所有 `is_active=true` 的播放源 |
| `verify-single` | `verify-queue` | 用户举报时触发 | 验证单条播放源可用性 |

---

## 用户角色体系

```typescript
type UserRole = 'user' | 'moderator' | 'admin'
```

权限继承：admin ⊃ moderator ⊃ user

---


---

## 前台路由结构

```
# 首页
/[locale]                              ← 首页

# 分类浏览页
/[locale]/browse                       ← 全部内容浏览
/[locale]/browse?type=movie            ← 电影
/[locale]/browse?type=series           ← 剧集
/[locale]/browse?type=anime            ← 动漫
/[locale]/browse?type=variety          ← 综艺

# 视频详情页（SSR，按类型分路径，利于 SEO）
/[locale]/movie/[slug]                 ← 电影详情（type=movie）
/[locale]/anime/[slug]                 ← 动漫详情（type=anime）
/[locale]/series/[slug]                ← 剧集详情（type=drama，URL 保留 /series/ 兼容 SEO，见 ADR-017）
/[locale]/variety/[slug]               ← 综艺详情（type=variety）
/[locale]/others/[slug]                ← 新增类型统一入口（type=short_drama/documentary/music/sports/news/children/game_show/other）

# 视频播放页（CSR）
/[locale]/watch/[slug]                 ← 播放页（?ep=N 指定集数）

# 搜索
/[locale]/search                       ← 搜索结果页

# 片单
/[locale]/collections                  ← 片单列表
/[locale]/collections/[id]             ← 片单详情

# 用户
/[locale]/auth/login                   ← 登录
/[locale]/auth/register                ← 注册
/[locale]/profile                      ← 个人中心

# 后台（见 /admin 路由结构章节）
/[locale]/admin/...
```

**slug 格式**：`{title-en-kebab}-{shortId}`，例：`attack-on-titan-aB3kR9x`

**URL 前缀 ↔ VideoType 映射**：

| URL 路径前缀 | `videos.type` 值 | 说明 |
|-------------|-----------------|------|
| `/movie/` | `movie` | 电影 |
| `/anime/` | `anime` | 动漫 |
| `/series/` | `series` | 连续剧 / 剧集 |
| `/variety/` | `variety` | 综艺 |
| `/others/` | `short` / `documentary` / `music` / `sports` / `news` / `kids` / `other` | 其他类型统一入口 |
| `/watch/` | 任意 | 播放页，不区分类型 |

**browse 查询参数 ↔ type 映射**：`/browse?type=series`（剧集）、`/browse?type=short` 等，参数值与 `videos.type` 枚举值一致。

---

## /admin 路由结构

```
/admin                          ← 重定向到 /admin/dashboard
/admin/dashboard                ← 数据看板（admin only）

# 内容管理区（moderator + admin）
/admin/videos                   ← 视频列表（含上下架、待审筛选）
/admin/videos/new               ← 手动添加视频
/admin/videos/[id]/edit         ← 编辑视频元数据
/admin/sources                  ← 播放源列表（含失效筛选）
/admin/submissions              ← 用户投稿资源审核队列
/admin/subtitles                ← 用户字幕审核队列
/admin/collections              ← 片单管理（创建/编辑/下架）
/admin/reports                  ← 举报处理（内容失效类）

# 系统管理区（admin only）
/admin/users                    ← 用户列表（封号/解封/角色管理）
/admin/crawler                  ← 采集域统一入口（4 tab：Sites/Console/Logs/Settings，见 ADR-014）
/admin/analytics                ← 数据看板（流量/播放/搜索统计）
/admin/reports/accounts         ← 举报处理（账号违规类）
```

**访问控制规则（Next.js middleware 层实现）：**
- `/admin/*` 全部路径：未登录 → 重定向 `/auth/login`；`role === 'user'` → 重定向 `/admin/403`
- `/admin/users`、`/admin/crawler`、`/admin/analytics`：`role !== 'admin'` → 重定向 `/admin/403`

---

## videos 表补充字段

### 治理层字段（Migration 013/016）

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `type` | TEXT | — | 内容形式，11 种：`movie`/`series`/`anime`/`variety`/`documentary`/`short`/`sports`/`music`/`news`/`kids`/`other`；Migration 019（CHG-176）从旧 12 种重建 |
| `source_content_type` | TEXT | NULL | 爬虫原始类型字符串，不规范化 |
| `normalized_type` | TEXT | NULL | 平台规范化分类，当前与 `type` 保持一致 |
| `content_format` | TEXT | NULL | `movie`/`episodic`/`collection`/`clip` |
| `episode_pattern` | TEXT | NULL | `single`/`multi`/`ongoing`/`unknown` |
| `visibility_status` | TEXT | `internal` | **主可见性字段**；`public`/`hidden`/`internal`/`blocked`；替代 `is_published`（见 ADR-018） |
| `review_status` | TEXT | `pending_review` | `pending_review`/`approved`/`rejected`/`blocked` |
| `review_reason` | TEXT | NULL | 审核备注 |
| `review_source` | TEXT | NULL | `system`/`ai`/`manual` |
| `reviewed_by` | UUID | NULL | FK → users |
| `reviewed_at` | TIMESTAMPTZ | NULL | 审核时间 |
| `needs_manual_review` | BOOLEAN | `false` | 是否需要人工复核 |
| `is_published` | BOOLEAN | `false` | **deprecated**；保留用于向后兼容，由 `VideoService`/`CrawlerService` 与 `visibility_status` 同步写入，不得在新代码中直接写入（见 ADR-018 方案 B） |

**前台 API 约束（Migration 016 后）**：所有面向用户的视频查询使用 `WHERE visibility_status = 'public'`（旧代码逐步从 `is_published = true` 迁移）。

**索引补充：**
```sql
-- 旧索引（保留兼容期）
CREATE INDEX IF NOT EXISTS idx_videos_published ON videos(is_published) WHERE is_published = true;
-- 新索引（Migration 016）
CREATE INDEX IF NOT EXISTS idx_videos_visibility ON videos(visibility_status);
CREATE INDEX IF NOT EXISTS idx_videos_review_status ON videos(review_status);
```

---

## 状态所有权补充（adminStore）

后台管理相关状态独立存放 `adminStore`，不混入 `playerStore` 或 `authStore`：

| 状态字段 | 唯一写入方 | 说明 |
|---------|-----------|------|
| `selectedVideoIds` | 视频管理列表组件 | 批量操作选中的视频 |
| `crawlerStatus` | 爬虫管理页面 | 当前各资源站运行状态 |
| `pendingCounts` | 后台 layout（轮询） | 各审核队列待处理数量（导航角标） |
