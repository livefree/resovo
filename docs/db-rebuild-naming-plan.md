# DB 命名重建方案 — VideoType / VideoGenre 正交化

**创建时间**：2026-03-25
**状态**：✅ 已完成（SEQ-20260325-02 全部 7 个任务完成，2026-03-25）

---

## 问题背景

当前 `video.types.ts` 中存在两处命名冲突：

| 冲突点 | 当前值 | 问题 |
|--------|--------|------|
| `VideoType.drama` | 表示连续剧（内容形式） | 与 `VideoCategory.drama`（题材：剧情类）语义重叠 |
| `VideoType.documentary` | 表示纪录片（内容形式） | 与 `VideoCategory.documentary`（题材：纪录片类）语义重叠 |
| `VideoType.short_drama` | 短剧 | 命名混乱，`short` 是形式，`drama` 是题材 |
| `VideoType.game_show` | 游戏类综艺 | `game_show` 是综艺的子类型，不是独立形式 |
| `VideoType.children` | 儿童内容 | 与 `VideoCategory.animation`（动画）存在重叠，且字段名不规范 |
| `VideoCategory.sci-fi` | 科幻 | 连字符不符合下划线规范 |
| `VideoCategory` 整体 | 8 种 | 缺少爱情、战争、武侠、家庭、传记等常见题材 |

**根本原因**：VideoType（内容形式/载体形式）与 VideoCategory（内容题材/内容主题）未严格正交。两者混用同一个词语，导致筛选逻辑、类型判定、爬虫分类等多处产生歧义。

---

## 设计原则

1. **VideoType = 内容形式**（How it's packaged）：电影 / 连续剧 / 动画片 / 综艺节目 / 纪录片 / …
2. **VideoGenre = 内容题材**（What it's about）：动作 / 喜剧 / 爱情 / 惊悚 / …
3. **两个维度严格正交**：同一个词不得在两个维度同时出现
4. **命名规范**：全部小写，多词用下划线，不用连字符

---

## 新值域定义

### VideoType（11 种，内容形式）

| 新值 | 旧值 | 含义 |
|------|------|------|
| `movie` | `movie` | 电影（不变） |
| `series` | `drama` | 连续剧/电视剧（避免与题材 drama 冲突） |
| `anime` | `anime` | 动画（不变） |
| `variety` | `variety` + `game_show` | 综艺节目（game_show 合并为综艺子类） |
| `documentary` | `documentary`（从 genre 移入） | 纪录片（内容形式，而非题材） |
| `short` | `short_drama` | 短剧/短片 |
| `sports` | `sports` | 体育赛事（不变） |
| `music` | `music` | 音乐节目（不变） |
| `news` | `news` | 新闻/资讯（不变） |
| `kids` | `children` | 儿童内容（规范化命名） |
| `other` | `other` | 其他（不变） |

### VideoGenre（15 种，内容题材）— 替代现有 VideoCategory

| 新值 | 旧值 | 含义 |
|------|------|------|
| `action` | `action` | 动作 |
| `comedy` | `comedy` | 喜剧 |
| `romance` | ——（新增） | 爱情/浪漫 |
| `thriller` | `thriller` | 惊悚 |
| `horror` | `horror` | 恐怖 |
| `sci_fi` | `sci-fi`（修正下划线） | 科幻 |
| `fantasy` | `fantasy` | 奇幻/魔幻 |
| `history` | `history` | 历史/古装 |
| `crime` | `crime` | 犯罪 |
| `mystery` | `mystery` | 悬疑 |
| `war` | ——（新增） | 战争 |
| `family` | ——（新增） | 家庭/亲情 |
| `biography` | ——（新增） | 传记/人物 |
| `martial_arts` | ——（新增） | 武侠/功夫 |
| `other` | ——（新增） | 其他 |

**移除的旧 VideoCategory 值**：`drama`（移入题材语义由 VideoType.series 承担）、`animation`（动画是内容形式 anime/kids，而非题材）、`documentary`（移入 VideoType）

---

## 数据库变更策略

### 推荐方案：新增 Migration 019（增量迁移）

开发阶段数据库可重建，但保留迁移历史有助于后续演进。

```sql
-- 019_rebuild_video_type_genre.sql
BEGIN;

-- 1. 重命名列：category → genre
ALTER TABLE videos RENAME COLUMN category TO genre;

-- 2. 更新 type 列的旧值 → 新值
UPDATE videos SET type = 'series'     WHERE type = 'drama';
UPDATE videos SET type = 'short'      WHERE type = 'short_drama';
UPDATE videos SET type = 'kids'       WHERE type = 'children';
UPDATE videos SET type = 'variety'    WHERE type = 'game_show';
-- documentary 保留（从 genre 含义转为 type 含义，值名不变）

-- 3. 更新 genre 列的旧值 → 新值
UPDATE videos SET genre = 'sci_fi'    WHERE genre = 'sci-fi';
UPDATE videos SET genre = NULL        WHERE genre IN ('drama', 'animation', 'documentary');

-- 4. 更新 type CHECK 约束（需先删除旧约束）
ALTER TABLE videos DROP CONSTRAINT IF EXISTS videos_type_check;
ALTER TABLE videos ADD CONSTRAINT videos_type_check
  CHECK (type IN ('movie','series','anime','variety','documentary','short','sports','music','news','kids','other'));

-- 5. 更新 genre CHECK 约束
ALTER TABLE videos DROP CONSTRAINT IF EXISTS videos_category_check;
ALTER TABLE videos ADD CONSTRAINT videos_genre_check
  CHECK (genre IS NULL OR genre IN (
    'action','comedy','romance','thriller','horror','sci_fi',
    'fantasy','history','crime','mystery','war','family','biography','martial_arts','other'
  ));

COMMIT;
```

### 完全重建方案（开发环境可选）

```bash
# 删除 dev 数据库，重新运行全部迁移
dropdb resovo_dev && createdb resovo_dev
psql resovo_dev < src/api/db/migrations/001_initial_schema.sql
# ... 运行 002~018，再运行 019
```

---

## 受影响文件清单

### TypeScript 类型层
- `src/types/video.types.ts` — 重写 VideoType、VideoGenre（删除 VideoCategory）

### 数据库迁移
- `src/api/db/migrations/019_rebuild_video_type_genre.sql`（新建）
- `src/api/db/migrations/001_initial_schema.sql`（可选：同步更新注释和 CHECK 约束）

### 后端查询层
- `src/api/db/queries/videos.ts` — DbVideoRow.category→genre，mapVideoRow 更新
- `src/api/routes/admin/videos.ts` — VideoMetaSchema/ListQuerySchema Zod enum 更新
- `src/api/routes/public/videos.ts` — 若有 category 筛选参数

### 后端服务层
- `src/api/services/VideoService.ts` — category→genre 字段，创建/更新路径
- `src/api/services/CrawlerService.ts` — type 映射逻辑（drama→series 等）
- `src/api/services/SearchService.ts` — ES 索引字段名

### 前端类型标签
- `src/components/browse/BrowseFilters.tsx` — TYPE_LABELS、GENRE_LABELS
- `src/components/browse/BrowseGrid.tsx` — 若有 type/category 显示
- `src/components/admin/videos/` — type 下拉、genre 下拉
- `src/app/[locale]/browse/page.tsx` — 筛选参数解析

### ES 索引
- `src/api/lib/elasticsearch.ts` — index mapping（category→genre 字段名）
- `src/api/db/queries/search.ts` — 查询条件字段名

### 测试
- `tests/helpers/factories.ts` — VideoType/VideoGenre fixture
- `tests/unit/**` — 所有使用 VideoCategory 的测试

### 文档
- `docs/architecture.md` — VideoType/VideoGenre 枚举表

---

## 迁移顺序

```
CHG-175（类型定义）
    ↓
CHG-176（Migration 019）
    ↓
CHG-177（查询层 + Zod schema）
    ↓
CHG-178（服务层写入逻辑）
    ↓
CHG-179（前端标签 + 筛选）
    ↓
CHG-180（测试 fixtures + 测试用例）
    ↓
CHG-181（全量验收 + architecture.md 同步）
```

---

## 验收标准

- `npm run typecheck` — 零报错
- `npm run lint` — 零警告
- `npm run test -- --run` — 全部通过
- `grep -r "VideoCategory" src/` — 零结果（已完全替换为 VideoGenre）
- `grep -r "short_drama\|game_show\|children" src/types/` — 零结果
- `grep -r '"drama"' src/types/` — 零结果（VideoType 层面）
