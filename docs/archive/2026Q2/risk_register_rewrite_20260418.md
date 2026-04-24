# 重写期风险登记表（M0–M6）

> status: archived
> owner: @engineering
> scope: rewrite-period risk register
> source_of_truth: no
> supersedes: none
> superseded_by: docs/decisions.md, docs/rules/workflow-rules.md
> last_reviewed: 2026-04-24

- **创建日期**：2026-04-18
- **适用阶段**：前端重大重写期（设计系统 + 播放器全局化 + 页面过渡动画）
- **关联 ADR**：ADR-024（主题/品牌正交）、ADR-026（播放器 Portal）、ADR-027（View Transitions 四分类）、ADR-029（Cloudflare Images + R2）
- **关联决策**：ADR-030（重写期 SSR/SEO 降级与风险边界策略）

> 登记规则：每项风险必须在 PR / 任务卡中显式引用 RISK-ID，触发预案时须在 changelog.md 中记录并回写本表状态。

---

## RISK-01：GlobalPlayerHost Portal 化对 `/watch/[slug]` SSR 元数据的影响

| 字段 | 内容 |
| --- | --- |
| 风险 ID | RISK-01 |
| 标题 | Portal 化播放器导致 OG tags / `schema.org VideoObject` SSR 输出缺失或错位 |
| 关联 ADR | ADR-026（播放器 Portal 提升至 Root Layout） |
| 触发场景 | 将播放器由路由级组件迁至 Root Layout Portal 后，若误把 OG tags 与 JSON-LD 放入客户端 PlayerHost 组件内部、或 `generateMetadata()` 依赖客户端状态读取当前视频信息，则 SSR HTML 中播放器相关 meta 会丢失或变成默认值 |
| 触发概率 | **H** — Portal 化重构易引发"组件搬家顺手搬 meta"的习惯性错误；此路径历史上已有多次误植入 client component 的迹象 |
| 影响等级 | **H** — Lighthouse SEO 分数直接掉入 70 区间；视频详情页在搜索引擎失去 rich snippet 展示，量化损失：视频详情页 CTR 预估下降 15%–25%（基于 Google Search Console 历史分组对比） |
| 检测方式 | 1. Lighthouse CI（`@lhci/cli`）接入 PR check，**SEO 分数 ≥ 90** 为门禁；<br>2. `curl -s http://localhost:3000/en/watch/test-slug \| grep -E 'og:video\|VideoObject'` 必须返回 ≥ 2 条匹配；<br>3. Playwright 冒烟：禁用 JS 后访问 `/watch/[slug]`，断言 `<meta property="og:video">` 与 `<script type="application/ld+json">` 均存在；<br>4. CI job `pnpm test:seo` 覆盖上述三项，失败即阻断合并 |
| 预案 | **降级路径**：发现 SSR meta 缺失时，立即回滚 `PlayerHost` Portal 化改动至上一个 release tag；特性开关 `NEXT_PUBLIC_PLAYER_PORTAL=false` 走旧的路由级挂载路径（M0 保留兼容层，M3 才允许删除）；同时将 `generateMetadata()` 的静态部分（title / og / VideoObject）与 Portal 渲染彻底解耦，通过 Server Component 直接读取 DB/cache |

---

## RISK-02：Edge middleware 品牌识别导致冷启动延迟

| 字段 | 内容 |
| --- | --- |
| 风险 ID | RISK-02 |
| 标题 | Cookie-based 品牌路由使 Vercel Edge 冷启动延迟超出预算 |
| 关联 ADR | ADR-024（主题与品牌上下文正交 + SSR 首屏无闪烁） |
| 触发场景 | Edge middleware 在品牌识别阶段引入额外 I/O（例如：远程 KV 查询、DB fetch、JWT 解码 + 鉴权），或同步读取多个 cookie 做合并逻辑；Vercel Edge Runtime 冷启动叠加时 p95 易突破 100ms |
| 触发概率 | **M** — 品牌读取本身只是 cookie parse，但容易在后续迭代中被"顺手"加入更多逻辑（会员身份、AB 实验桶分配）；缺乏硬性上限约束时退化倾向明显 |
| 影响等级 | **M** — 海外用户首字节时间（TTFB）劣化 30–80ms；Core Web Vitals 的 LCP 受影响，SEO 排名下降；Vercel Edge 执行时间计费上升（超出 50ms 免费额度） |
| 检测方式 | 1. Vercel Analytics 面板监控 Edge function **p95 < 50ms**；<br>2. CI 中通过 `vercel inspect --logs` 采样 100 次请求的 `x-vercel-id` + `x-vercel-edge-region` 计算 p95；<br>3. 本地 `pnpm bench:middleware` 基准：1000 次调用 middleware 的总耗时 / 1000 < 2ms（不含网络）；<br>4. 在 middleware 内部打点 `performance.now()` 差值 > 5ms 时输出 warning 日志并上报 |
| 预案 | **降级路径**：若 middleware p95 >= 50ms 持续 10 分钟，触发告警并自动切换至 `BRAND_STRATEGY=default-only` 特性开关——此时 middleware 不再读 cookie，所有请求走默认品牌 `resovo`，品牌选择改由客户端 hydration 后替换（牺牲首屏正确性换可用性）；cookie 缺失情形下永远 fallback 到 `resovo` 而非抛错；严禁在 middleware 中引入 fetch / DB / KV 调用，违反时通过 lint 规则 `no-edge-side-io` 阻断 |

---

## RISK-03：View Transitions API 在 Safari < 18 的降级行为

| 字段 | 内容 |
| --- | --- |
| 风险 ID | RISK-03 |
| 标题 | Safari 17 及更早版本缺失 `document.startViewTransition` 导致过渡动画不可用或抛错 |
| 关联 ADR | ADR-027（页面过渡四分类模型） |
| 触发场景 | `<RouteStack>` 内部直接调用 `document.startViewTransition(() => ...)`，未做 feature detection；用户在 Safari 17（iOS 17 / macOS Sonoma）上点击任意路由切换时触发 `TypeError: document.startViewTransition is not a function` |
| 触发概率 | **M** — 海外用户 Safari 占比 ≈ 25%，其中 iOS 17 仍有相当份额（iOS 18 发布至今不足一年），Android Chrome 端不受影响；实现时若依赖他人示例代码，漏判降级的概率中等 |
| 影响等级 | **M** — 受影响用户所有路由跳转失败或白屏；量化影响：Safari 17 用户占比 × 跳转失败率 ≈ 总流量 5%–10% 的可用性损失；品牌口碑与留存受损 |
| 检测方式 | 1. Playwright 在 WebKit 17 channel 运行路由切换 e2e（`playwright install webkit@17` + 自定义 profile），断言**无 console error** 且页面成功切换；<br>2. BrowserStack 真机矩阵 Safari 17.0 / 17.4 / iOS 17 回归；<br>3. CI 统计：过渡调用路径若命中 Safari 17，必须走"直接切换"分支，通过埋点 `view_transition_fallback_used` 的 ratio 监控（预期 = Safari<18 流量占比，偏差 >20% 视为实现有误）；<br>4. 视觉回归：在 Safari 17 模拟器下路由切换前后截图，像素 diff ≤ 1 帧（瞬切允许） |
| 预案 | **降级路径**：在 `<RouteStack>` 与所有调用点强制 `if ('startViewTransition' in document)` 的 feature detection；未命中分支直接调用 `router.push()`（无动画瞬切）；**禁止引入 View Transitions polyfill**（体积 ≈ 25KB + 运行时性能不佳，bundle size 不合算）；若发现仍有残留调用点抛错，启用特性开关 `NEXT_PUBLIC_ROUTE_TRANSITIONS=off` 全站关闭过渡动画，回到默认 Next.js 路由行为 |

---

## 汇总与跟踪

| 风险 ID | 状态 | 负责人 | 最近检查 | 备注 |
| --- | --- | --- | --- | --- |
| RISK-01 | Open | @frontend-lead | 2026-04-18 | M2 实施 PlayerHost Portal 前必须完成验证 CI |
| RISK-02 | Open | @frontend-lead | 2026-04-18 | M1 middleware 落地时同步引入 lint 规则 |
| RISK-03 | Open | @frontend-lead | 2026-04-18 | M4 接入 View Transitions 时必须带降级 e2e |

> 本登记表在每个 milestone（M0–M6）结束前由主循环负责人复核一次，状态变更写入 changelog.md。
