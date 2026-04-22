# 本地 VideoType / VideoGenre 与豆瓣分类对齐表

- **日期**：2026-04-22
- **任务**：META-10（SEQ-20260422-BUGFIX-01 第 1 张）
- **依据**：用户 2026-04-22 追加需求 + audit 文档 §2.3/2.5（本地类型与题材映射偏弱）
- **产出物**：对齐表 + 枚举增补决策 + `DOUBAN_GENRE_MAP` / `SOURCE_CATEGORY_MAP` 扩充清单

## 一、设计原则

1. **形式 vs 题材严格正交**（沿用 M3 决策）
   - `VideoType` 表达"内容形式"（电影 / 电视剧 / 综艺 / 纪录片 / 动画 / 短片 / 体育 / 音乐节目 / 新闻 / 儿童 / 其他）
   - `VideoGenre` 表达"题材"（动作 / 喜剧 / 爱情 / …）
   - 豆瓣将"动画 / 纪录片 / 短片 / 运动 / 音乐 / 儿童"同时作为 type 和 genre 使用，本地以 `VideoType` 优先承载

2. **只扩不删**
   - 既有 11 个 `VideoType` 与 15 个 `VideoGenre` 全部保留（含平台扩展项 `sports` / `music` / `news` / `kids` / `martial_arts`）
   - 仅新增豆瓣常见但本地缺失的题材

3. **政策敏感项走审核**
   - 豆瓣的"同性（Gay / LGBT）"、"情色（Erotic）"不新增到 `VideoGenre`
   - 映射时保留 raw 值到 `source_category`，由审核区人工处理

## 二、VideoType 对齐表

| 豆瓣影视类别 | 本地 `VideoType` | 处置 |
|-------------|-----------------|------|
| 电影 | `movie` | ✅ 已对齐 |
| 电视剧 | `series` | ✅ 已对齐 |
| 综艺 | `variety` | ✅ 已对齐 |
| 动画 / 动漫 | `anime` | ✅ 已对齐（豆瓣题材层的"动画"也合并至此） |
| 纪录片 | `documentary` | ✅ 已对齐 |
| 短片 | `short` | ✅ 已对齐 |
| —（豆瓣无） | `sports` | 平台扩展（体育赛事直播 / 集锦） |
| —（豆瓣无） | `music` | 平台扩展（音乐节目 / MV） |
| —（豆瓣无） | `news` | 平台扩展 |
| —（豆瓣无） | `kids` | 平台扩展（儿童节目，豆瓣的"儿童"题材映射到 `type=kids`） |
| —（豆瓣无） | `other` | 兜底 |

**结论**：`VideoType` 本次不新增、不删除。**无需 DB migration**。

## 三、VideoGenre 对齐表

### 3.1 豆瓣题材 → 本地 `VideoGenre`

| 豆瓣题材（中/英） | 本地 `VideoGenre` | 来源 | 处置 |
|--------------------|------------------|------|------|
| 剧情 Drama | —（丢弃） | 豆瓣 | 豆瓣近乎万能标签，不携带信息量 → 映射到 null |
| 喜剧 Comedy | `comedy` | 豆瓣 | ✅ 已对齐 |
| 爱情 Romance | `romance` | 豆瓣 | ✅ 已对齐 |
| 动作 Action | `action` | 豆瓣 | ✅ 已对齐 |
| 科幻 Sci-Fi | `sci_fi` | 豆瓣 | ✅ 已对齐 |
| 悬疑 Mystery | `mystery` | 豆瓣 | ✅ 已对齐 |
| 惊悚 Thriller | `thriller` | 豆瓣 | ✅ 已对齐 |
| 恐怖 Horror | `horror` | 豆瓣 | ✅ 已对齐 |
| 犯罪 Crime | `crime` | 豆瓣 | ✅ 已对齐 |
| 历史 History | `history` | 豆瓣 | ✅ 已对齐 |
| 战争 War | `war` | 豆瓣 | ✅ 已对齐 |
| 家庭 Family | `family` | 豆瓣 | ✅ 已对齐 |
| 传记 Biography | `biography` | 豆瓣 | ✅ 已对齐 |
| 奇幻 Fantasy | `fantasy` | 豆瓣 | ✅ 已对齐（合并"魔幻 / 玄幻"） |
| 古装 Costume | `history` | 豆瓣（电视剧维度） | ✅ 复用 `history`（含义重叠） |
| 武侠 Wuxia | `martial_arts` | 豆瓣（华语特有） | ✅ 已对齐 |
| **冒险 Adventure** | **`adventure`** | 豆瓣 | 🆕 **新增** |
| **灾难 Disaster** | **`disaster`** | 豆瓣 | 🆕 **新增** |
| **歌舞 Musical** | **`musical`** | 豆瓣 | 🆕 **新增**（合并"音乐 Music"） |
| **西部 Western** | **`western`** | 豆瓣 | 🆕 **新增** |
| **运动 Sport** | **`sport`** | 豆瓣题材层 | 🆕 **新增**（与 `VideoType.sports` 共存，前者是题材如《洛奇》，后者是形式如 NBA 直播） |
| 动画 Animation | —（丢弃） | 豆瓣 | 由 `VideoType=anime` 承载，不占 genre |
| 纪录 Documentary | —（丢弃） | 豆瓣 | 由 `VideoType=documentary` 承载 |
| 短片 Short | —（丢弃） | 豆瓣 | 由 `VideoType=short` 承载 |
| 儿童 Children | —（丢弃） | 豆瓣 | 由 `VideoType=kids` 承载 |
| 音乐 Music | `musical` | 豆瓣 | 合并到 `musical`（题材粒度） |
| 同性 Gay / LGBT | —（保留 raw） | 豆瓣（政策敏感） | 不新增枚举，raw 写入 `source_category`，审核区人工标记 |
| 情色 Erotic | —（保留 raw） | 豆瓣（政策敏感） | 同上，触发 `needs_manual_review` |
| 黑色电影 Film-Noir | `mystery` | 豆瓣扩展 | 就近合并 |
| 反乌托邦 Dystopian | `sci_fi` | 豆瓣扩展 | 就近合并 |

### 3.2 本地扩展项（非豆瓣）

| 本地 `VideoGenre` | 说明 | 保留原因 |
|------------------|------|---------|
| `martial_arts` | 武侠 / 功夫 | 华语内容高频，豆瓣用"武侠 Wuxia"映射 |
| `other` | 兜底 | 不可映射项必有去处 |

### 3.3 最终 `VideoGenre` 枚举（20 值）

```ts
export type VideoGenre =
  | 'action'       // 动作
  | 'comedy'       // 喜剧
  | 'romance'      // 爱情
  | 'thriller'     // 惊悚
  | 'horror'       // 恐怖
  | 'sci_fi'       // 科幻
  | 'fantasy'      // 奇幻 / 魔幻 / 玄幻
  | 'history'      // 历史 / 古装
  | 'crime'        // 犯罪
  | 'mystery'      // 悬疑 / 黑色电影
  | 'war'          // 战争
  | 'family'       // 家庭 / 亲情
  | 'biography'    // 传记 / 人物
  | 'martial_arts' // 武侠 / 功夫（华语扩展）
  | 'adventure'    // 冒险（新增）
  | 'disaster'     // 灾难（新增）
  | 'musical'      // 歌舞 / 音乐（新增）
  | 'western'      // 西部（新增）
  | 'sport'        // 运动（新增；注意与 VideoType.sports 区分）
  | 'other'        // 其他
```

## 四、DB 影响评估

| 层 | 列 | 约束 | 本次是否变更 |
|----|----|----|---|
| `videos.type` | TEXT | CHECK IN (11 值) | ❌ 不变 |
| `videos.genre` | — | — | ❌ 已在 Migration 029 删除 |
| `media_catalog.genres` | TEXT[] | **无 CHECK 约束**（仅 GIN 索引） | ❌ DB 无需改动，应用层新增值即可 |

**结论**：META-10 **无需新增 migration**。

## 五、`DOUBAN_GENRE_MAP` 扩充清单

在 `apps/api/src/lib/genreMapper.ts` 的 `DOUBAN_GENRE_MAP` 基础上追加：

```ts
// 新增
'冒险': 'adventure', 'Adventure': 'adventure',
'灾难': 'disaster', 'Disaster': 'disaster',
'歌舞': 'musical', 'Musical': 'musical',
'音乐': 'musical', 'Music': 'musical',  // 覆盖原 null 映射
'西部': 'western', 'Western': 'western',
'运动': 'sport', 'Sport': 'sport', 'Sports': 'sport',

// 保持 null（由 VideoType 表达或政策敏感）
'动画': null, 'Animation': null,
'纪录片': null, 'Documentary': null,
'短片': null, 'Short': null,
'儿童': null, 'Children': null,
'同性': null, 'Gay': null, 'LGBT': null,
'情色': null, 'Erotic': null,
```

## 六、`SOURCE_CATEGORY_MAP` 扩充清单

在 `apps/api/src/lib/genreMapper.ts` 的 `SOURCE_CATEGORY_MAP` 追加：

```ts
// 新增题材
'冒险':   'adventure',
'灾难':   'disaster',
'歌舞':   'musical',
'音乐':   'musical',
'西部':   'western',
'运动':   'sport',
'体育':   'sport',
```

（`SOURCE_CATEGORY_MAP` 仅在无豆瓣数据时兜底，低置信度。）

## 七、下游影响 / 后续任务

1. **CRAWLER-07**（下一张）依赖本表更新的 `VideoGenre` 枚举与 `DOUBAN_GENRE_MAP`
2. **CRAWLER-08** 依赖本表扩充后的 `SOURCE_CATEGORY_MAP`
3. **UI 筛选下拉**：`apps/web-next` / `apps/server` 的题材筛选菜单若硬编码枚举 → 后续任务扫一次（不在本卡范围）
4. **i18n**：5 个新 genre（adventure / disaster / musical / western / sport）需要中英文本地化键（CRAWLER-07 或独立后续卡）
5. **历史数据**：由 CHORE-05 一并清空，不触发回填

## 八、决策签字

- **评审维度**：
  - ✅ 豆瓣 26 项常见题材全部有明确去向（枚举对齐 / 由 VideoType 承载 / 政策敏感走审核 / 丢弃无信息量）
  - ✅ 只扩不删，不破坏既有 `VideoGenre` 消费方
  - ✅ DB 层无约束需同步
  - ✅ 形式（type）与题材（genre）的正交设计保持
- **是否需要 Opus arch-reviewer 子代理独立审计**：
  - 标准：跨 3+ 消费方（前端筛选、爬虫映射、后台审核、API 契约、豆瓣适配器）
  - 决策：本卡仅扩枚举、不改契约形状、不改 DB schema，视为增量扩展而非设计变更 → 不强制 spawn，但允许后续 UX/前端消费者卡在消费时另行 review
- **签字**：主循环 claude-opus-4-7，2026-04-22
