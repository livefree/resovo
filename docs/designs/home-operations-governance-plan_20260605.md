# 首页运营治理方案 — UI/UX 同构编辑器 + 自动填充体系

> status: active proposal
> owner: @engineering
> scope: `/admin/home` UI/UX governance, home curation contracts, autofill policy
> source_of_truth: design-plan
> supersedes: none
> superseded_by: none
> last_reviewed: 2026-06-05

## 0. 背景与目标

本方案响应用户对首页运营位的新改造要求：

- 后台页面展示应与前台首页一致，但各区块可编辑 / 设置。
- 视频卡片支持拖动、删除。
- 各区块预设空卡片支持添加视频。
- 各模块要有自动填充方式。
- 热门电影、电视剧从豆瓣获取；热门动漫从 Bangumi 读取。
- 顶部 Banner 设置必须提供横版大图。

现状基础：

- 前台首页结构为 `HeroBanner`、分类捷径、`FeaturedRow`、`TopTenRow`、热门电影、热播剧集、热门动漫。
- 后台 `/admin/home` 已有 `home_modules` 列表编辑、拖拽、删除、批量添加、趋势导入、Top10 自动补位可视化。
- `home_banners` 与 `home_modules.slot='banner'` 同时存在，前台 `HeroBanner` 当前消费 `/banners` / `home_banners`，存在 Banner 双真源风险。
- 豆瓣 / Bangumi 元数据与本地匹配能力已存在，但首页自动填充尚未形成统一治理策略。

目标是把首页运营从“记录列表编辑”升级为“前台同构画布 + 区块策略 + 自动候选 + 发布审计”的治理系统。

## 1. 输入输出契约

### 输入

1. 人工运营配置：Banner、精选、Top10、分类入口、热门区块的手动 pinned 条目与区块设置。
2. 站内视频池：已发布、可见、可播放的视频及封面、类型、评分、元数据状态。
3. 外部热度源：
   - 豆瓣：热门电影、热门电视剧候选。
   - Bangumi：热门动漫候选，优先使用 rank，排除 nsfw。
4. 运行上下文：brand、locale、preview time、设备视口。

### 输出

1. 前台首页真实渲染数据：各区块最终卡片列表，含 pinned / auto 标识。
2. 后台编辑画布：与前台首页同顺序、同布局、同卡片语义的可编辑视图。
3. 自动填充解释：每个自动候选的来源、分数、排名、过滤原因或入选原因。
4. 审计记录：人工创建 / 更新 / 删除 / 排序 / 发布 / 自动候选应用。

## 2. 治理原则

1. **单一展示真源**：前台首页最终展示必须来自统一的 Home Curation 聚合结果；后台画布预览也消费同一聚合口径。
2. **人工优先，自动补位**：手动 pinned 条目优先，自动候选只补空位，不覆盖人工运营判断。
3. **自动可解释**：自动填充不能只给结果，必须展示来源、排序原因、被过滤原因。
4. **Banner 强约束**：首屏 Banner 是品牌主视觉，不允许仅靠视频封面兜底；必须提供合格横版大图。
5. **配置与内容分离**：区块策略归 Home Curation；视频、豆瓣、Bangumi 数据仍归各自服务，避免 UI 直连 DB 或跨层调用。
6. **发布可回滚**：运营修改必须可审计；高影响操作（发布、删除、应用自动候选）可追溯。

## 3. 信息架构

`/admin/home` 应采用三栏或两栏增强形态：

```text
┌──────────────────────────────────────────────────────────────┐
│ PageHeader：首页运营  预览前台 / 保存草稿 / 发布 / 审计        │
├──────────────────────────────────────────────────────────────┤
│ 环境栏：brand / locale / preview time / desktop-mobile        │
├───────────────────────────────┬──────────────────────────────┤
│ 前台同构画布                   │ 右侧 Inspector                │
│ 1. Hero Banner                 │ - 当前区块设置                │
│ 2. 分类快捷入口                │ - 自动填充策略                │
│ 3. 精选推荐                    │ - 候选池 / 过滤原因           │
│ 4. Top10                       │ - 时间窗 / 发布状态           │
│ 5. 热门电影                    │ - 图片 / 文案 / 链接设置       │
│ 6. 热播剧集                    │                              │
│ 7. 热门动漫                    │                              │
└───────────────────────────────┴──────────────────────────────┘
```

原则：

- 画布是主工作区，不再以 slot tab 作为唯一入口。
- 区块点击后右侧 Inspector 展示设置。
- 每个卡片在 hover / focus 时显示拖拽、替换、删除、固定、取消固定等操作。
- desktop / mobile 预览必须同时支持，Banner 裁切尤其要双端可见。

## 4. 区块治理模型

| 区块 | 前台形态 | 人工能力 | 自动填充 | 数据真源建议 |
|---|---|---|---|---|
| Hero Banner | 首屏横幅轮播 | 新建、排序、启停、删除、横图上传、链接视频/外链 | 不允许全自动发布；可给候选 | `home_banners` 作为 Hero 真源，纳入 `/admin/home` |
| 分类快捷入口 | 类型入口 chips/cards | 排序、显示隐藏、标题 | 按类型可见视频数补角标 | `home_modules.type_shortcuts` 或后续裁定退役 |
| 精选推荐 | 前台 Featured 网格 | 添加、拖拽、删除、固定 | 站内趋势 / 外部热门混合补位 | `home_modules.featured` + 聚合端点 |
| Top10 | 排行横滑 | 添加、拖拽、删除、固定 | rating / 热度补足 10 个 | 现有 `/home/top10` 扩展解释字段 |
| 热门电影 | poster shelf | 可固定头部若干卡 | 豆瓣热门电影 → 站内可播视频映射 | 新 Home Curation 自动策略 |
| 热播剧集 | poster shelf | 可固定头部若干卡 | 豆瓣热门电视剧 → 站内可播视频映射 | 新 Home Curation 自动策略 |
| 热门动漫 | poster shelf | 可固定头部若干卡 | Bangumi rank/rating → 站内可播视频映射 | 新 Home Curation 自动策略 |

## 5. 卡片交互规范

### 5.1 视频卡片

所有视频型区块卡片统一支持：

- 拖拽排序：同区块内排序立即预览，保存后事务提交。
- 删除：仅从运营位移除，不删除视频实体；危险操作二次确认。
- 替换：打开 `VideoPicker`，保留当前排序位。
- 固定 / 取消固定：自动卡片可一键转 pinned；pinned 卡片可释放为自动补位。
- 状态展示：`pinned`、`auto`、待生效、已过期、引用失效、图片缺失、不可播放。

### 5.2 空卡片

空卡片不是普通 EmptyState，而是前台布局中的占位卡：

- Banner 空位：显示“添加横版 Banner”，点击进入 Banner Inspector。
- 视频空位：显示“添加视频”，点击打开 VideoPicker。
- 自动空位：显示“开启自动填充”或“查看候选”。
- 空位数量由区块 `displayCount` 决定，例如 Top10 固定 10 个槽位。

### 5.3 拖拽边界

- 视频卡片可在视频型区块间拖动，但跨区块落位必须触发确认，因为语义从 featured 变为 top10 / hot shelf 会改变排序策略。
- Banner 不接受普通 poster 卡片直接落位；若拖入视频，只能作为链接目标，仍必须补横版大图。
- 分类入口不接受视频卡片，只接受 video type / category 配置。

## 6. Banner 横版大图治理

Banner 是首屏视觉真源，必须强约束：

1. `imageUrl` 必填；不能仅使用 video coverUrl 兜底发布。
2. 推荐尺寸 1920x1080；最低 1280x720。
3. 比例建议 16:9 到 21:9；超出范围禁止发布或要求裁切。
4. 上传后必须展示 desktop 与 mobile 安全区预览。
5. 支持 focal point 设置，避免移动端裁切主体。
6. 外链图必须通过尺寸探测；探测失败时标记风险，不允许直接发布到 Hero。
7. Banner 文案与链接可选，但主图不可选。

治理裁定：

- `home_banners` 继续作为 `HeroBanner` 首屏真源。
- `/admin/home` 统一承载 Banner 编辑入口。
- `home_modules.slot='banner'` 需要后续 ADR 裁定：退役、迁移为非 Hero 运营位，或与 `home_banners` 合并。裁定前不得让运营维护两套可同时影响首屏的 Banner 配置。

## 7. 自动填充策略

### 7.1 通用算法

每个区块最终展示按以下顺序生成：

```text
pinned 手动条目
→ 自动候选排序
→ 站内兜底趋势
→ 空卡片占位
```

通用过滤：

- `is_published=true`
- `visibility_status` 前台可见
- 非成人内容
- 至少有一条可播放源
- 图片可用，或有明确 fallback
- 当前 brand / locale 可展示
- 未被当前首页其它区块占用，除非区块设置允许重复

### 7.2 自动模式

| 模式 | 说明 | 适用 |
|---|---|---|
| manual_only | 只展示人工 pinned，不自动补 | Banner、重大专题 |
| manual_plus_autofill | pinned 优先，空位自动补 | featured、top10、热门区块 |
| suggest_only | 只生成候选，需人工应用 | Banner 候选、活动期精选 |
| full_auto | 全部来自策略，运营只设规则 | 热门电影 / 剧集 / 动漫 shelf |

默认建议：

- Banner：`suggest_only`
- featured：`manual_plus_autofill`
- top10：`manual_plus_autofill`
- 热门电影 / 热播剧集 / 热门动漫：`full_auto`，但允许 pinned 头部覆盖。

## 8. 豆瓣 / Bangumi 热榜策略

### 8.1 豆瓣热门电影 / 剧集

候选来源：

- 本地 `external_data.douban_entries`。
- 优先使用已有 douban id / external refs 映射到 `media_catalog` 与站内视频。
- 若豆瓣条目未映射到站内可播视频，仅进入“缺口候选”，不直接展示到前台。

排序建议：

```text
douban_votes 权重
+ rating 权重
+ 最近上线/更新权重
+ 站内可播放源健康权重
- 图片缺失/源不稳定惩罚
```

电影与剧集必须分开候选池：

- 热门电影只取 movie。
- 热播剧集只取 series。
- 类型无法确认时进入候选审核，不自动入前台。

### 8.2 Bangumi 热门动漫

候选来源：

- 本地 `external_data.bangumi_entries`。
- 优先 `rank ASC`，其次 `rating DESC`。
- 必须过滤 `nsfw=true`。
- 通过 `bangumi_subject_id` / `video_external_refs(provider='bangumi')` 映射到站内 anime 视频。

排序建议：

```text
rank 越小越靠前
+ rating
+ 站内可播放源健康
+ 最近更新
- 集数缺失/图片缺失惩罚
```

未映射到站内可播视频的 Bangumi 条目进入“内容缺口”列表，可供采集/占位建库，但不直接展示。

## 9. 后端边界建议

新增 Home Curation 聚合层，避免 UI 直连各业务查询：

```text
Route
  → HomeCurationService
    → home module/banner queries
    → video queries
    → externalData queries
    → source health queries
```

建议端点：

| 端点 | 说明 |
|---|---|
| `GET /admin/home/preview` | 返回完整首页预览，参数含 brand、locale、at、device |
| `GET /admin/home/sections` | 返回区块配置与当前发布状态 |
| `PATCH /admin/home/sections/:section/settings` | 更新区块设置 |
| `GET /admin/home/autofill-candidates` | 获取某区块自动候选与解释 |
| `POST /admin/home/sections/:section/apply-autofill` | 将候选转为 pinned |
| `POST /admin/home/sections/:section/reorder` | 区块内排序 |

新增端点需要 ADR；若只是扩展现有 `/home/top10` / `/home/modules` 响应字段，走对应 ADR amendment。

## 10. 状态归属

| 状态 | 归属 |
|---|---|
| 卡片是否 pinned | Home Curation 配置 |
| 卡片排序 | Home Curation 配置 |
| 视频是否可播放 | Video / Source 服务 |
| 视频评分、类型、年份 | Video / MediaCatalog |
| 豆瓣热门候选 | externalData + HomeCuration 排序策略 |
| Bangumi 热门候选 | externalData + HomeCuration 排序策略 |
| Banner 横图 | Banner 配置 + media image 管线 |
| 预览设备、locale、brand | `/admin/home` UI state，不写 DB |

## 11. 发布与审计

发布模型建议分三层：

1. 编辑态：后台本地状态或草稿配置，不影响前台。
2. 预览态：`GET /admin/home/preview` 以草稿 + 当前数据聚合。
3. 发布态：写入正式配置，前台查询生效。

审计必须覆盖：

- create / update / delete
- reorder
- publish toggle
- apply autofill
- banner image update
- section settings update

审计 payload 要包含 before / after、候选来源、自动策略版本、操作者与 request id。

## 12. 缓存与一致性

- 前台首页可以保留短 TTL，但后台发布后应主动失效相关 key。
- Top10 现有 60s 缓存策略可以保留，但后台预览必须跳过或显式标记缓存时间。
- 豆瓣 / Bangumi 候选可缓存，但应用到首页时必须重新校验视频可见性与可播放性。
- 自动候选列表中的“已不可用”必须在 UI 中标灰并显示过滤原因。

## 13. 实施拆卡建议

### Phase 1：真源与同构预览

1. `CHG-HOME-GOV-ADR`：起草 Home Curation ADR，裁定 Banner 真源、section settings、自动候选端点。
2. `CHG-HOME-BANNER-UNIFY`：`/admin/home` 纳入 `home_banners` 编辑，明确 `home_modules.banner` 去留。
3. `CHG-HOME-PREVIEW-API`：新增完整首页预览聚合端点。
4. `CHG-HOME-CANVAS`：后台从 slot list 升级为前台同构画布。

### Phase 2：卡片操作闭环

1. `CHG-HOME-CARD-DND`：同构画布内卡片拖拽、跨区块确认。
2. `CHG-HOME-EMPTY-SLOTS`：各区块空卡片添加入口。
3. `CHG-HOME-BANNER-IMAGE-GUARD`：Banner 横图尺寸、比例、安全区、focal point 校验。

### Phase 3：自动填充

1. `CHG-HOME-AUTOFILL-CORE`：通用自动填充策略、去重、解释模型。
2. `CHG-HOME-AUTOFILL-DOUBAN`：豆瓣热门电影 / 剧集候选。
3. `CHG-HOME-AUTOFILL-BANGUMI`：Bangumi 热门动漫候选。
4. `CHG-HOME-AUTOFILL-APPLY`：候选应用为 pinned + 审计。

### Phase 4：发布治理

1. `CHG-HOME-DRAFT-PUBLISH`：草稿 / 预览 / 发布模型。
2. `CHG-HOME-AUDIT-ROLLBACK`：审计回滚与 diff 展示。
3. `CHG-HOME-CACHE-INVALIDATE`：发布后缓存失效。

## 14. 验收标准

功能验收：

- 运营能在 `/admin/home` 看到与前台首页同顺序、同布局的画布。
- 每个区块都可进入设置面板。
- 视频卡片可拖拽、删除、替换、固定 / 取消固定。
- 每个区块空位可添加视频或开启自动填充。
- Banner 发布前必须有合格横版大图。
- 热门电影 / 热播剧集候选来自豆瓣，并只展示站内可播放映射。
- 热门动漫候选来自 Bangumi，并排除 nsfw。
- 自动候选可解释、可跳过、可应用。

质量验收：

- 后端保持 Route → Service → DB queries 分层。
- UI 不直接调用 DB queries。
- 新端点必须有 ADR 或 ADR amendment。
- 写操作必须有 audit log 测试断言。
- 前台首页、后台 `/admin/home`、自动候选 API 有单测与 E2E / 视觉回归覆盖。

## 15. 非目标

- 本方案不要求本卡直接实现代码。
- 不引入新第三方依赖。
- 不把未映射的豆瓣 / Bangumi 条目直接展示到前台。
- 不允许为了自动化绕过人工 Banner 横图审核。

## 16. 当前方案结论

首页运营的下一阶段不应继续堆叠 slot 表单能力，而应建立 Home Curation 治理层：

```text
前台同构画布
+ 区块设置 Inspector
+ pinned / auto 双轨卡片
+ 豆瓣 / Bangumi 可解释候选
+ Banner 横图强约束
+ 发布审计与缓存失效
```

这能把运营动作从“改数据库记录”收敛为“配置首页展示策略”，也为后续多品牌、多语言、活动档期与外部榜单治理留下清晰扩展面。
