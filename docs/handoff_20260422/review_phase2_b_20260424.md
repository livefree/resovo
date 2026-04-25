# REVIEW-B 审计报告

日期：2026-04-24
审计模型：arch-reviewer（claude-opus-4-6）
覆盖范围：HANDOFF-22 / 23 / 24 / 27 / 28 / 29

## 总结

**PASS** — 阻塞项 #2（TopTenRow sortStrategy 未消费）已于 2026-04-24 修复。全部 8 项审计结论通过，Batch C 可启动。

修复记录：`TopTenRow.tsx` 新增 `strategy` state 读取 API 响应的 `sortStrategy` 字段，内部映射 i18n key `topTenSubtitleManualPlusRating` / `topTenSubtitleComposite`；`page.tsx` 移除静态 `subtitle` prop；两份 messages 文件追加对应键。

---

## 逐项结论

### 1. FeaturedRow 数据降级路径
**结论：PASS**

- 空数组 → `FeaturedGrid` 渲染 4 个虚线占位 `<div>`（`shelf-empty-opacity`），不白屏
- API 报错 → `catch(() => setVideos([]))` 安全降级，section 标题始终可见
- loading skeleton 与正文布局（`gridTemplateColumns: '1.6fr 1fr 1fr 1fr'`）结构一致

### 2. TopTenRow sortStrategy 向前兼容
**结论：NEED_FIX ⚠️**

`Top10Response.sortStrategy` 在 types 注释中明确约定"前端根据此字段从 i18n 字典取副标题文案"，但：
- `TopTenRow.tsx` 完全未读取 `res.data.sortStrategy`（只取 `res.data.items`）
- `subtitle` 由 `page.tsx` 静态传入 `t('topTenSubtitle')`，与策略字段脱钩
- 后端升级策略时前端文案不会自动切换，违背类型契约

修复方案：
1. `TopTenRow.tsx`：新增 `useState<string>` 存 `sortStrategy`；从 API 响应读取并映射到 i18n key
2. `page.tsx:65`：移除硬传 `subtitle={t('topTenSubtitle')}`，由组件内部决定
3. i18n 文件：新增 `topTenSubtitle.manualPlusRating` / `topTenSubtitle.composite` 两条

### 3. FeaturedRow / TopTenRow Props 类型
**结论：PASS**

- 零 `any`，所有类型从 `@resovo/types` 导入
- RowHeader 在两个组件内各有独立实现（2 处重复，未达 3 处沉淀门槛）
- 建议：Batch C/D 若出现第 3 处 RowHeader 使用，当时任务内沉淀至 `primitives/row-header/`

### 4. parseHighlight() XSS 安全性
**结论：PASS**

- `<em>` 内容通过 `match[1]` 捕获组提取为纯字符串，走 React text node 渲染，无 HTML 注入路径
- 目标文件范围内 `dangerouslySetInnerHTML` 零命中
- 畸形标签场景：正则按"最外层 `<em>...</em>`"非贪婪匹配，剩余内容作字符串显示，无 XSS 风险

### 5. Pagination primitive 复用情况
**结论：PASS**

- `SearchPage.tsx` 与 `BrowseGrid.tsx` 均 import 同一 `@/components/primitives/pagination`
- Props 完整（page / totalPages / onPrev / onNext），disabled 边界守卫已实现

### 6. DetailPage CastBlock 正确性
**结论：PASS（含 1 个非阻塞建议）**

- `director.length === 0 && cast.length === 0` 时返回 null，条件正确
- 展开/收起文案与状态对应，无 `any`
- **建议**：React key `${role}-${name}` 若演员重名会冲突，建议加索引后缀（非阻塞）

### 7. 首页新区块颜色变量合规
**结论：PASS**

`FeaturedRow.tsx` / `TopTenRow.tsx` / `CategoryShortcutsClient.tsx` 三文件所有颜色属性全部使用 `var(--*)` 变量，零 hex / rgb / rgba / oklch / hsl 字面量。

### 8. 首页区块顺序对照
**结论：PASS（含 1 处合理差异说明）**

page.tsx 实现顺序（CategoryShortcuts → FeaturedRow → TopTenRow → 影片/剧集/动漫 ShelfRow）与 home-b-2.html 设计稿完全一致。

**合理差异**：设计稿 "正在热播的剧集" 使用 `landscape` 宽卡变体，当前实现走 portrait。建议 Batch C/D 任务卡记录此差异，明确是补 landscape 变体还是设计对齐决策。

---

## 需修复项清单

| 优先级 | 文件 | 问题 |
|--------|------|------|
| **阻塞** | `TopTenRow.tsx` | 未消费 `sortStrategy`；subtitle 静态传入违背 types 契约 |
| **阻塞** | `page.tsx:65` | 硬传 `subtitle={t('topTenSubtitle')}` 需移除 |
| **阻塞** | `messages/*.json` | 需新增 `topTenSubtitle.manualPlusRating` / `.composite` |
| 建议 | `VideoDetailClient.tsx` CastBlock | React key 加索引后缀防重名冲突 |
| 说明 | `page.tsx` series ShelfRow | landscape 变体差异需 Batch C/D 任务卡记录决策 |

---

## 阻塞判定

**REVIEW-B PASS — Batch C 可启动。**（阻塞项已于 2026-04-24 修复，全部门禁通过）
其余建议项可 Batch C 内顺手处理或独立排期。
