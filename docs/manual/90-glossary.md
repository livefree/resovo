# 90 · 术语表

> 后台运营常见术语；按拼音首字母排序。

## B

- **Banner** · 首页轮播位。当前归属 `/admin/home` 的 Banner segment。
- **背景图（Backdrop）** · 视频详情页大图；P1 级图片，失效不阻塞播放。
- **暂存（Staging）** · 视频通过审核但未公开发布的中间状态。当前归属 `/admin/moderation?tab=staging`。

## C

- **采集（Crawl）** · 从外部源站抓取视频元数据 + 线路的过程。两种模式：**增量** / **全量**。
- **采集任务（Run）** · 一次采集触发产生的运行记录；可在 `/admin/crawler/runs` 查看历史。
- **CDN fallback 域** · 当主图片域失效时切换的备份图源 CDN。

## D

- **DualSignal · 双信号** · 视频源的「探测」+「播放」状态联合表达。探测 = HEAD/Content-Type 验证；播放 = 真实播放器渲染验证。任一为 dead 即视为不可用。
- **DataTable v2** · 后台一体化表格组件（toolbar + saved views + bulk + pagination + filter chips 全内置）。设计真源 reference §4.4。

## F

- **fallback 链** · 图片显示的四级降级：原图 → fallback CDN → 占位 → 颜色块。
- **freezeEnabled** · 系统级冻结开关；冻结期间禁止触发新采集任务。

## H

- **home_modules** · 首页运营位的数据模型；6 端点 CRUD（list/create/update/delete/reorder/publish-toggle）。设计稿 §5.7，ADR-104。

## J

- **金票（W1）** · "采集 → 审核 → 上架"端到端核心工作流；M-SN-8 必须 100% 闭合。

## L

- **线路（Source line）** · 一组视频集对应的播放地址集合；按 `(source_site_key, source_name)` 复合键标识（ADR-114-NEGATED 维持复合键方案）。
- **线路别名（Line displayName）** · 给线路起的方便记忆的中文代号；后端存储 + 矩阵列展示（设计要求；CHG-SN-8-XX 修复"只编辑不展示"的偏差）。

## M

- **mock 视图** · 用假数据填充的页面；M-SN-8 H1 硬约束**完全禁止**。
- **moderator** · 审核员角色，主要在审核台工作。

## P

- **P0 / P1 图片** · P0 = 视频封面（poster，必须可用）；P1 = 背景图（backdrop，可降级）。
- **Picker** · 业务级选择器（VideoPicker / SourceLinePicker 等）；目的是消灭 UUID 输入（H4 硬约束）。
- **Pill** · 状态徽章组件；颜色矩阵 ok/warn/danger/info 严格语义化。

## R

- **R-MID-1** · 项目内"协议变更须同步 7 文件框架"的 RETRO 协议（ADR-121）。

## S

- **Segment** · 分段切换控件（pill-style，含 badge）；M-SN-7 REDO-02 沉淀为 admin-ui primitive。
- **shortId** · 视频对外可见的短 ID（与内部 UUID 区别），运营复述用。
- **soft delete** · 软删除：仅标记 `is_deleted=true`，不物理删除。

## V

- **VisChip** · 「可见性 × 审核状态」联动单 chip；设计稿要求同语义在多页用同一 cell 组件。

## 缩写

- **PASS / CONDITIONAL / REJECT** · arch-reviewer 评级
- **ADR** · Architecture Decision Record（架构决策记录）
- **DoD** · Definition of Done（完成判定）
- **IA** · Information Architecture（信息架构 / 侧栏菜单 + 路由）
- **CHG** · Change（任务卡前缀，如 CHG-SN-7-CLEANUP-01-C）
- **SEQ** · Sequence（任务序列，如 SEQ-20260521-01）
- **REDO** · Re-do（设计稿对齐重做，M-SN-7 的子流派）
