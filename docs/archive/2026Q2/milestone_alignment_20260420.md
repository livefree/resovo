# 方案里程碑 ↔ 执行里程碑对齐表

- **创建日期**：2026-04-20
- **关联 ADR**：ADR-037（执行里程碑与方案里程碑对齐协议）
- **关联补丁**：`docs/task_queue_patch_regression_m1m2m3_20260420.md`
- **关联方案**：
  - `docs/design_system_plan_20260418.md`
  - `docs/frontend_redesign_plan_20260418.md`
  - `docs/image_pipeline_plan_20260418.md`
- **审计签字**：arch-reviewer (claude-opus-4-6) 子代理，REG-CLOSE-01 任务卡内独立审计 PASS（16/19 ✅，3/19 ⚠️ 已 ADR 记录，0 ❌）

---

## 1. 当前对齐状态（19 条 REGRESSION 基线）

> 本表覆盖方案 M1/M2/M3 在 apps/web-next 端的能力层。M4–M6 暂未启动，自 exec-M4 起按 ADR-037 决策 5 恢复方案编号对齐。

| 方案 M# | 方案要求 | 实现位置（apps/web-next） | REG 卡片 | 状态 |
|---------|---------|---------------------------|----------|------|
| **M1 — 基础设施（Design System）** | | | | |
| M1.1 Token 三子层 + brands/resovo | base/semantic/component + brands/resovo 子层 | `packages/design-tokens`（workspace 包，复用） | — | ✅ |
| M1.2 主题三态 ThemeProvider + Segmented | 三态切换器 + Context | `contexts/BrandProvider.tsx` + `hooks/useTheme.ts` + `components/ui/ThemeToggle.tsx` | REG-M1-01 | ✅ |
| M1.3 BrandProvider + useBrand | 品牌 Context + DEFAULT_BRAND_NAME 常量 | `contexts/BrandProvider.tsx` + `hooks/useBrand.ts` + `lib/brand-detection.ts:DEFAULT_BRAND_SLUG` | REG-M1-01 | ✅ |
| M1.4 middleware brand/theme cookie → header | Edge runtime 读 cookie + 注入 header | `middleware.ts` + `lib/brand-detection.ts`（HEADER_BRAND / HEADER_THEME） | REG-M1-02 | ✅ |
| M1.5 blocking script 首屏无闪烁 | `<head>` 内 sync script | `lib/theme-init-script.ts` + `app/[locale]/layout.tsx` `<head>` 注入 | — | ✅ |
| M1.6 Token 后台 MVP（11 项） | Diff / 继承 / 保存链路（V2 余 7 项） | API: `apps/api/src/routes/admin/design-tokens.ts` + `services/DesignTokensService.ts`<br>UI: `apps/server/src/components/admin/design-tokens/{DiffPanel,InheritanceBadge,TokenEditor}.tsx` | REG-M1-04-PREP | ⚠️ 3/11（ADR-043 记录推迟） |
| **M2 — 全局骨架 + Primitives** | | | | |
| M2.1 Root layout 四件套常驻 | Nav/Footer/Host/MainSlot | `app/[locale]/layout.tsx`（BrandProvider 内 4 件齐挂） | REG-M2-01 | ✅ |
| M2.2 useBrand 驱动触点 | Header/Footer/Logo/Footer text | layout `initialBrand` 注入；Nav/Footer 消费 useBrand | REG-M2-02 | ✅ |
| M2.3 PageTransition primitive | 四类过渡底层（sibling/push/takeover/overlay） | `components/primitives/page-transition/{PageTransition,PageTransitionController}.tsx` | REG-M2-03 | ✅ |
| M2.4 SharedElement primitive (FLIP 基建) | API 契约冻结（noop 合约 → M5 实装数学） | `components/primitives/shared-element/{SharedElement,registry}.tsx` | REG-M2-03 | ⚠️ noop 合约（M5 实装） |
| M2.5 RouteStack primitive (返回手势) | API 契约冻结（noop stub → M5 Tab Bar 实装） | `components/primitives/route-stack/RouteStack.tsx` | REG-M2-03 | ⚠️ noop stub（M5 实装） |
| M2.6 LazyImage + BlurHash | IntersectionObserver + blurhash 解码 | `components/primitives/lazy-image/{LazyImage,BlurHashCanvas}.tsx` | REG-M2-04 | ✅ |
| M2.7 SafeImage + FallbackCover (四级降级) | 真实图 → BlurHash → FallbackCover → CSS 渐变 | `components/media/{SafeImage,FallbackCover}.tsx` + `lib/image/image-loader.ts` | REG-M2-05 | ⚠️ 三级可见 + 渐变内嵌（实质等价） |
| M2.8 ScrollRestoration | 同层 scrollY 记忆 + 下钻返回校准 | `components/primitives/scroll-restoration/ScrollRestoration.tsx` | REG-M2-06 | ✅ |
| M2.9 PrefetchOnHover | PC hover 150ms → router.prefetch | `components/primitives/prefetch-on-hover/PrefetchOnHover.tsx` | REG-M2-06 | ✅ |
| **M3 — 播放器 root 化** | | | | |
| M3.1 GlobalPlayerHost (root + zustand 单例) | Portal 挂载 + 状态机 | `app/[locale]/_lib/player/GlobalPlayerHost.tsx` + `stores/playerStore.ts`（hostMode + LEGAL_TRANSITIONS + sessionStorage） | REG-M3-01 | ✅ |
| M3.2 mini 态 + FLIP full↔mini | Spotify 模式过渡 | `app/[locale]/_lib/player/{MiniPlayer,GlobalPlayerFullFrame}.tsx` | REG-M3-02 | ✅ |
| M3.3 pip 态（浏览器原生 PiP） | requestPip / leavepip 事件桥接 | `app/[locale]/_lib/player/pip.ts` + GlobalPlayerHost 内 PipSlot | REG-M3-03 | ✅ |
| M3.4 路由切换语义（离开 /watch → mini） | RoutePlayerSync + ConfirmReplaceDialog | `app/[locale]/_lib/route-player-sync.tsx` + `components/player/ConfirmReplaceDialog.tsx` + `app/[locale]/watch/[slug]/...` | REG-M3-04 | ✅ |

**汇总**：16/19 ✅，3/19 ⚠️（均有 ADR 记录），0/19 ❌

---

## 2. 未来对齐协议（自 exec-M4 起）

依据 ADR-037 决策 2/3/4/5：

### 2.1 里程碑命名

- **首选**：`exec-M4` = 方案 M4，`exec-M5` = 方案 M5，`exec-M6` = 方案 M6
- **拆分允许**：`exec-M4a` / `exec-M4b` 等子里程碑允许，但每个子里程碑必须显式声明覆盖的方案条目
- **跨方案合并**：若执行需要跨方案 M# 合并 → 必须写独立 ADR 记录原因

### 2.2 启动前对齐确认

每个 exec 里程碑启动**之前**，主循环必须输出：

1. **覆盖范围声明**：列出该里程碑覆盖的方案 M#.X 条目（章节编号精确到子节）
2. **偏离声明**：若有方案条目本里程碑不覆盖 → 在 task-queue 补丁中明确标注，并写独立 ADR
3. **依赖前置确认**：列出本里程碑依赖的前置 ADR / 前置 REG 条目

### 2.3 PHASE COMPLETE 必含对齐表

每个 PHASE COMPLETE 通知块必须包含本文件第 1 节风格的对齐表：

```markdown
## 方案 M# ↔ 执行里程碑对齐表

| 方案 M#.X | 方案要求摘要 | 实现卡片 | 状态 |
|-----------|-------------|---------|------|
| M4.1 ...  | ...         | TASK-ID | ✅/⚠️/❌ |
```

未列对齐表 → 视为未完成，下一里程碑不得启动。

### 2.4 完成宣告三件套

任何 exec 里程碑标 ✅ 前必须满足：

1. **方案条目全 ✅**（或 ⚠️ 但有独立 ADR 记录偏离）
2. **Opus arch-reviewer 子代理审计 PASS**（含"AUDIT RESULT: PASS"）
3. **审计结论与对齐表写入 `docs/changelog.md`**

任一项缺失 → 主循环写 BLOCKER 自停，禁止推进。

---

## 3. 历史偏差说明（exec-M1/M2/M3 vs 方案 M1/M2/M3）

### 3.1 偏差时间线

| 日期 | 事件 |
|------|------|
| 2026-04-18 | 三份方案文档发布（design_system / frontend_redesign / image_pipeline），定义 M1–M6 能力层 |
| 2026-04-18 | exec-M1（TOKEN-01～14）启动 — 主循环在 **apps/web** 端落地方案 M1 能力层 |
| 2026-04-18 | ADR-031 / ADR-035 落地，引入 apps/web → apps/web-next 网关 rewrite 协议 |
| 2026-04-18~19 | exec-M2 = 首页搬到 apps/web-next + variety→tvshow URL 改名 |
| 2026-04-19 | exec-M3 = 5 详情页搬家 + player-core 分包 + PlayerShell 搬到 apps/web-next |
| 2026-04-19 | M3 PHASE COMPLETE — 主循环对齐复盘发现方案 M1/M2/M3 在 apps/web-next 端能力层断档 |
| 2026-04-20 | REGRESSION 序列发布（14 张 REG 卡 + REG-CLOSE-01），ADR-037 起草 |
| 2026-04-20 | REGRESSION 阶段全部完成，Opus 子代理审计 PASS，REG-CLOSE-01 解除 BLOCKER |

### 3.2 偏差根因

**根因 1（推进视角偏移）**：ADR-035 网关 rewrite 协议引入后，主循环把推进视角默认落到"页面搬家进度"，方案的能力层在 apps/web-next 端事实上出现断档。搬家是**消费视角**，能力层是**生产视角**，两者不可互相代替。

**根因 2（命名同名误导）**：方案侧用 M1/M2/M3 命名能力层；执行侧也用 M1/M2/M3 命名搬家阶段。同名导致 PHASE COMPLETE 审计默认认为"方案 M# = exec-M#"，实际是双重命名空间。

**根因 3（无对齐表硬约束）**：旧的 PHASE COMPLETE 通知未要求对齐表，主循环可在不列出方案覆盖率的情况下宣告完成。

**根因 4（ADR 偏离声明缺失）**：ADR-035 引入 apps/web-next 时未同步声明 M1 能力层迁移节奏，导致迁移节奏隐式落空。

### 3.3 已采取的纠正措施

- **代码层**：REG-M1-01 至 REG-M3-04 共 13 张卡补齐能力层断档
- **协议层**：ADR-037 确立未来对齐协议（决策 1～5）
- **文档层**：本文件固化历史偏差与未来约束；CLAUDE.md「绝对禁止」追加"未含对齐表的 PHASE COMPLETE 视为未完成"
- **流程层**：`docs/rules/workflow-rules.md` 追加"里程碑启动前对齐确认"子条款
- **审计层**：自 exec-M4 起每个 PHASE COMPLETE 强制 Opus arch-reviewer 子代理独立审计

### 3.4 防止重蹈覆辙的检查清单

每次新里程碑启动前，主循环自检：

- [ ] 已读三份原方案对应章节
- [ ] 已识别本里程碑覆盖的方案 M#.X 条目（精确到子节编号）
- [ ] 已识别本里程碑**不覆盖**的方案条目，且已写偏离 ADR 或显式推迟声明
- [ ] task-queue 补丁含"方案 ↔ 执行 对齐表"
- [ ] 任务卡的"完成验收"含覆盖方案条目的具体证据要求
- [ ] PHASE COMPLETE 通知预计含对齐表
- [ ] 已规划 Opus arch-reviewer 子代理审计入口

---

**本文件维护**：每次新增 ADR-04X+ 后追加到第 1 节对齐表；每个 exec 里程碑完成后追加新章节（"方案 M4 ↔ exec-M4 对齐表"等）。

**关联文档**：
- `docs/decisions.md` — ADR-037 起规范化
- `docs/architecture.md` — 第 1 节 GlobalPlayerHost / BrandProvider / Root layout 四件套
- `docs/changelog.md` — REG-CLOSE-01 条目 + REGRESSION 阶段汇总
- `docs/task-queue.md` — REGRESSION PHASE COMPLETE 通知块
