# REGRESSION 阶段人工审核记录

- **创建时间**：2026-04-20
- **阶段**：SEQ-20260420-REGRESSION-M1/M2/M3/CLOSE
- **Opus 审计签字**：arch-reviewer (claude-opus-4-6)，REG-CLOSE-01 内独立审计，**AUDIT RESULT: PASS**（16/19 ✅，3/19 ⚠️，0/19 ❌）
- **子代理 ID**：ab7bd04ec0795cf45

---

## 1. 各卡"硬阻断"人工审核记录

| 任务卡 | 人工审核要求 | 结果 |
|--------|------------|------|
| REG-M1-01 | BrandProvider SSR 无闪烁，ThemeToggle 三态切换正常 | ⏳ 待人工确认 |
| REG-M1-02 | middleware cookie 注入 header，品牌/主题 SSR 正确识别 | ⏳ 待人工确认 |
| REG-M1-04-PREP | Token 后台 Diff 面板、InheritanceBadge、保存链路功能正常 | ⏳ 待人工确认 |
| REG-M2-01 | Root layout 四件套常驻（Nav/Footer/GlobalPlayerHost/MainSlot），无重复渲染 | ⏳ 待人工确认 |
| REG-M2-02 | useBrand 驱动 Nav/Footer 品牌名显示正确 | ⏳ 待人工确认 |
| REG-M2-03 | PageTransition 过渡动画正常，SharedElement/RouteStack noop 无 crash | ⏳ 待人工确认 |
| REG-M2-04 | LazyImage 懒加载正常，BlurHash 占位显示 | ⏳ 待人工确认 |
| REG-M2-05 | SafeImage 破图降级正常，FallbackCover 显示品牌色 | ⏳ 待人工确认 |
| REG-M2-06 | ScrollRestoration 跨路由恢复正常，PrefetchOnHover hover 预取生效 | ⏳ 待人工确认 |
| REG-M3-01 | GlobalPlayerHost Portal 正常挂载，playerStore hostMode 状态机正确 | ⏳ 待人工确认 |
| REG-M3-02 | MiniPlayer 固定右下，full↔mini FLIP 过渡动画正常 | ⏳ 待人工确认 |
| REG-M3-03 | PiP 按钮（若浏览器支持）可触发，leavepictureinpicture 事件桥接正常 | ⏳ 待人工确认 |
| REG-M3-04 | 离开 /watch 触发 full→mini，ConfirmReplaceDialog 在 slug mismatch 时弹出 | ⏳ 待人工确认 |

> 注：所有卡片代码质量门禁（typecheck ✅ lint ✅ unit 1136/1136 ✅）均已通过，人工审核仅覆盖视觉/交互层。

---

## 2. REG-M3-04 端到端人工回归（6 个场景）

| # | 场景 | 预期行为 | 实测结果 |
|---|------|---------|---------|
| 1 | 断点续播 | 进入已看过的视频，进度条从上次位置继续 | ⏳ 待人工确认 |
| 2 | 线路切换 | 点击"线路"切换后自动播放新源 | ⏳ 待人工确认 |
| 3 | 剧场模式 | 点击影院模式，layout 切换为剧场布局 | ⏳ 待人工确认 |
| 4 | 字幕 | （暂无字幕源，跳过） | 不适用 |
| 5 | mini 跨路由持续播放 | 在 /watch 播放 → 导航到首页 → mini 播放器出现（含展开/关闭） | ⏳ 待人工确认 |
| 6 | 替换视频 ConfirmDialog | 在 mini 播放时访问另一个 /watch/[slug] → 弹出替换确认对话框 | ⏳ 待人工确认 |

> 说明：mini 播放器当前无真实视频画面（已知限制，视频元素保持存活属后续重构）；"出现"指控件可见且展开/关闭按钮功能正确。

---

## 3. E2E 测试基线状态（REG-M3-04 完成时）

- **单元测试**：1136/1136 ✅（全绿）
- **E2E（apps/web-next）**：未在 REGRESSION 阶段运行完整 E2E（已知失败项见 `docs/known_failing_tests_phase3.md` quarantine 列表）
- **E2E 说明**：player-shell 等 testid 已随 PlayerShell 进入 Portal，document-wide 选择器无需修改；Portal 内渲染不影响 Playwright `page.getByTestId` 选择。

---

## 4. REGRESSION 期间 BLOCKER 记录

| BLOCKER | 触发原因 | 处置 |
|---------|---------|------|
| REGRESSION 阶段启动 BLOCKER | 方案 M1/M2/M3 与 exec-M1/M2/M3 能力层语义错位（19 项断档） | REG-CLOSE-01 完成后解除（ADR-037 落地，Opus 审计 PASS） |

无其他 BLOCKER 在 REGRESSION 期间触发。

---

## 5. Opus 审计摘要

**审计员**：arch-reviewer (claude-opus-4-6)，子代理 ID：ab7bd04ec0795cf45

**审计范围**：补丁第 2 节对齐表 19 条 + 三个特别关注项

**结论**：AUDIT RESULT: **PASS**

| 分类 | 数量 |
|------|------|
| ✅ 完全通过 | 16 / 19 |
| ⚠️ 部分达成（ADR 记录偏差，接受） | 3 / 19 |
| ❌ 不可接受 | 0 / 19 |

**3 个 ⚠️ 偏差详情**：

1. **M1.6 Token 后台**：11 项中补齐 3 项（Diff/继承/保存），余 7 项推迟到 V2（ADR-043 记录触发条件）
2. **M2.4 SharedElement**：noop 合约冻结，FLIP 数学推迟到 M5 页面重制（已修正源文件 TODO 文案）
3. **M2.7 SafeImage**：四级降级链的"CSS 渐变兜底"层内嵌于 FallbackCover，非独立可见层（实质等价，ADR-045 补充说明）

**审计员轻量建议**（均已在 REG-CLOSE-01 内执行）：

- ✅ SharedElement.tsx TODO 文案修正（"REG-M3-01 填充" → "M5 页面重制阶段实装"）
- ✅ ADR-045 追加四级降级层级合并说明
- ✅ ADR-043 追加 V2 推迟项触发条件
