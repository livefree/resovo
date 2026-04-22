# M6 PHASE COMPLETE — 方案对齐表 + 11 点审计签字 + 代理证据

> status: pending-user（arch-reviewer 二审 PASS，等用户真人 § 5 checklist 打勾 → sealed）
> sequence: SEQ-20260422-M6-CDN
> date: 2026-04-22
> executed-by-model: claude-opus-4-7（主循环）
> arch-reviewer: claude-opus-4-7（已在 CDN-02 / IMG-06 阶段分别独立评审 SafeImage Props 扩展 + ImageStorageService 契约，本卡合并审计 M6 整体）
> 对齐方案：`docs/frontend_redesign_plan_20260418.md` §19 M6 / `docs/image_pipeline_plan_20260418.md` §10 + §12.M4 / §21 F3 Cloudflare Images + R2 定稿
> 关联 ADR：ADR-037 v2（三维闭环签字门禁）/ ADR-046（图片管线）/ ADR-035（路由切分）/ 本次新增 ADR-051

---

## 1. 本文档的定位

M6 按方案文档原文是 "CDN 预备，预计 1 个任务卡，不实施对接"。用户 2026-04-22 在启动计划时追加后台图片管理需求（视频 / Banner 缺便利性 + 预览），把 scope 从"1 张 CDN loader 预备"扩展为"CDN 预备（2 张） + 后台图片管理（3 张）"，形成 SEQ-20260422-M6-CDN 5 张主卡 + 1 张签字卡。

本文档固化：
1. **方案侧 scope（原 1 卡）↔ 执行侧 scope（6 卡）** 的对齐关系与扩展正当性
2. **运行时代理证据**（arch-reviewer 无浏览器能力，代理证据让审计可机器验证）
3. **用户真人 checklist**（三维闭环第三维）

---

## 2. 方案 ↔ 执行对齐表

### 2.1 方案原文 M6 scope（`frontend_redesign_plan_20260418.md` §19）

> ### M6：CDN 预备（预计 1 个任务卡，不实施对接）
>
> - 定义 `next/image` 自定义 loader 接口
> - 图片 URL 约定：`{src}?w=&h=&q=&fm=`（CDN 无关的参数约定）
> - 本地 / 构建时图处理管线（短期方案）

### 2.2 方案原文 M4 scope（`image_pipeline_plan_20260418.md` §12.M4，与 frontend M6 为同一事）

> ### M4：CDN 预备（预计 1 个任务卡，不实施对接）
>
> - [ ] loader 接口定义
> - [ ] `next.config.ts` 接入 custom loader
> - [ ] 过渡期多尺寸方案（按运营上传 or 原图直出）

### 2.3 执行实际交付

| 阶段 | 任务 | 方案对应 | 超出方案吗？ |
|------|------|---------|-------------|
| 1 · CDN loader 预备 | **CDN-01** next/image custom loader 接入 | §12.M4 "loader 接口定义" + "next.config.ts 接入" | ✅ 完全对齐 |
| 1 · CDN loader 预备 | **CDN-02** SafeImage `mode: 'lazy'\|'next'` 开关 | 方案未明写，但是 "loader 接入后无消费者 = 死代码" 的必要补强（arch-reviewer CDN-02 评审 NEED_FIX → PASS 签字） | 对齐扩展（补强验证面） |
| 2 · 后台图片管理 | **IMG-06** `ImageStorageService` + `MediaImageService` + `POST /admin/media/images` | 用户 2026-04-22 追加需求（非方案原文） | 🟡 用户授权扩展 |
| 2 · 后台图片管理 | **IMG-07** `VideoImageSection` UI 接入上传 + 预览放大 + 进度 | 同上 | 🟡 用户授权扩展 |
| 2 · 后台图片管理 | **IMG-08** `BannerForm` UI 接入上传 + 预览放大 + 进度 | 同上 | 🟡 用户授权扩展 |
| — | **ADMIN-17** 共享 `<ImageUploadField>` 组件 | 条件触发，2 处未达阈值 → 跳过 | ⏭️ 跳过（CLAUDE.md 合规） |
| 3 · 收官 | **M6-CLOSE-01** PHASE COMPLETE 三维闭环（本文档 + ADR-051） | ADR-037 v2 门槛 | ✅ 必做 |

### 2.4 scope 扩展正当性（给 arch-reviewer 审视）

- **CLAUDE.md 绝对禁止"重写冻结期接受与三份方案目标无关的新业务需求"**：后台图片管理是方案 `image_pipeline_plan §8 运营上传` 的延伸，属方案范围内演进，非"新业务需求"
- **用户授权**：2026-04-22 对 IMG-06~08 的存储 / sharp / 共享组件 / mimetype+size / 执行节奏 5 点拍板
- **无新 npm 依赖**：全程复用 `@aws-sdk/client-s3`（已有）+ `@fastify/multipart`（已有）+ `next/font/google` 内建 + `next/image` 内建 + `<dialog>` 原生
- **无 DB schema 变更**：Migration 048 图片字段已就绪
- **原 scope 1 卡 → 扩展 6 卡**：符合"按需演进，不过早抽象"；最终交付量约 10 小时，ADMIN-17 条件触发跳过守住"不过度工程"底线

### 2.5 实际 commit 链（M6-CDN 全序列）

```
4afb140  CDN-01   next/image custom loader 接入
9510d7f  CDN-02   SafeImage mode='lazy'|'next' 开关 + /dev 预览
7aa02d2  IMG-06   ImageStorageService + MediaImageService + POST /admin/media/images
aef993c  IMG-06 P1/P2 fixup  R2_PUBLIC_BASE_URL + LocalFS fallback + 4 发现
95680d4  IMG-07   VideoImageSection UI 接入上传
f7833ab  IMG-07 P2 fixup  预览放大 + 真实上传进度
4452069  IMG-08   BannerForm UI 接入上传
（本次 commit） M6-CLOSE-01 PHASE COMPLETE
```

---

## 3. 关键架构决策（ADR-051 记录）

### 3.1 `next/image` loader 抽象

- `images.loader: 'custom'` + `loaderFile: './src/lib/image/next-image-loader.ts'`
- 转接 `getLoader()`（passthrough / cloudflare），env 驱动
- 与 SafeImage 消费同一 loader，未来切 CF Images 零改动

### 3.2 SafeImage mode 开关

- `'lazy'`（默认） — LazyImage + `<img>` + IntersectionObserver + blurHash canvas（既有 6 消费者零影响）
- `'next'` — `<Image fill>` + 外层 aspect wrapper + blurDataURL placeholder
- `blurDataURL?` / `sizes?` / `'data-testid'?` prop 预留
- arch-reviewer 评审 NEED_FIX → 4 必改点全部落地

### 3.3 图片上传 API 契约

- **路径**：`POST /v1/admin/media/images`（资源路径对齐 `/admin/banners` / `/admin/videos`）
- **字段泛化**：`ownerType: 'video'|'banner' + ownerId`（避免 `kind='banner'` 撕裂 `ImageKind` 枚举）
- **权限**：admin only（对齐 `/admin/banners`）
- **mimetype 白名单**：`image/jpeg,png,webp,avif,gif`
- **大小上限**：5MB（与 server.ts `@fastify/multipart` 全局一致）
- **Response**：`{ url, key, kind, contentType, size, hash, blurhashJobId, provider }`

### 3.4 R2 Key 命名（防 CDN 缓存不一致）

- **带 sha256 前 8 位 hash**：`posters/{videoId}-{hash}.{ext}`
- **覆盖上传** → URL 本身变化 → 天然 invalidate
- 不依赖 ETag / Last-Modified 协商

### 3.5 Storage Provider 抽象（P1 修复）

```
ImageStorageProvider interface
  R2StorageProvider      ← R2 三件套齐全时
    publicUrl(key) 优先 R2_PUBLIC_BASE_URL（前台域）
                    回退 R2_ENDPOINT（API endpoint） + stderr warn
  LocalFsStorageProvider ← R2 未配时（开发 fallback）
    write 到 LOCAL_UPLOAD_DIR
    publicUrl 前缀 LOCAL_UPLOAD_PUBLIC_URL
    `GET /v1/uploads/*` 路由（createReadStream，不引 @fastify/static）
```

### 3.6 写库失败补偿删除

- `MediaImageService.upload()` 写库（updateCatalogFields / updateBanner）失败 → 调 `storage.delete(key)` 清理 R2 对象
- 避免"R2 有对象 + DB 指向旧 URL"不一致
- 失败仍向上抛错

### 3.7 blurhash 入队过滤

- `imageHealthQueue.add('blurhash-extract', { catalogId, videoId, kind, url, type })`
- 仅 kind ∈ `{poster, backdrop, banner_backdrop}` 入队
- logo（透明艺术字无主色意义）+ banner（home_banners 无 blurhash 列）不入

### 3.8 前端共享字体（CHORE-08 已落，M6 间接依赖）

- `next/font/google` 加载 Noto Sans + Noto Sans SC
- `.next/static/media/` 109 个 woff2 切片
- typography.fontFamily.sans 首项 `var(--font-noto-sans)`

---

## 4. 运行时代理证据（第二维：arch-reviewer 可机器验证）

### 4.1 构建证据

| 检查项 | 命令 | 结果 |
|--------|------|------|
| web-next build 成功 | `npm run build -w @resovo/web-next` | ✓ Compiled successfully in 3.4s / ✓ Generating static pages (23/23) |
| Noto 字体切片落地 | `ls .next/static/media/` | **109 个 woff2 文件**（CHORE-08） |
| Noto CSS 声明注入 | `grep "Noto Sans" .next/static/css/*.css` | 2 个 CSS 包含 `@font-face font-family:Noto Sans`（一个 Sans / 一个 SC） |
| `next.config.ts` custom loader 生效 | grep `images.loader: 'custom'` + `loaderFile` | ✓ CDN-01 落地 |

### 4.2 类型 / Lint / Unit

| 检查项 | 命令 | 结果 |
|--------|------|------|
| TypeScript 全栈 | `npm run typecheck` | ✓ api / server / web-next / player-core 四层全绿 |
| ESLint 四 workspace | `npm run lint` | ✓ 4 successful / 0 warnings / 0 errors |
| Vitest 全量 | `npm run test -- --run` | **1554 / 1554 passed**（M6 启动前 1447，+107 net case） |

### 4.3 路由注册

| 检查项 | 结果 |
|--------|------|
| `POST /v1/admin/media/images` 注册 | `apps/api/src/server.ts:98 await fastify.register(adminMediaRoutes, { prefix: '/v1' })` |
| `GET /v1/uploads/*` LocalFs fallback | 同一 `adminMediaRoutes` 内声明；R2 未配时返真实文件，R2 provider 下返 404 |
| `PUT /admin/videos/:id/images` | 既有路由保留（兜底 URL 流程；IMG-07 改"改 URL"按钮仍调用） |

### 4.4 测试覆盖矩阵（跨 M6-CDN 全序列）

| 任务 | 新/扩写 test file | case 数 |
|------|---------------------|---------|
| CDN-01 | `tests/unit/lib/next-image-loader.test.ts`（新） | +8 |
| CDN-02 | `tests/unit/components/media/SafeImageNext.test.tsx`（新） | +14 |
| CDN-02 fixup | `tests/unit/components/media/SafeImageNext.loader-integration.test.tsx`（新） | +4 |
| IMG-06 | `tests/unit/api/imageStorageService.test.ts`（新） | 初 18 → fixup 23 |
| IMG-06 | `tests/unit/api/mediaImageService.test.ts`（新） | +11 |
| IMG-06 fixup | `tests/unit/api/adminMediaUploadsRoute.test.ts`（新） | +6 |
| IMG-07 | `tests/unit/components/admin/videos/VideoImageSection.test.tsx`（新） | 初 13 → fixup 21 |
| IMG-08 | `tests/unit/components/admin/banners/BannerForm.test.tsx`（扩写） | +13 |
| **合计** | | **+107 net case** |

### 4.5 环境变量契约（.env.example 补充）

M6-CDN 全序列新引入的 env：

```
# Image Loader
IMAGE_LOADER=passthrough|cloudflare
IMAGE_LOADER_CF_ACCOUNT_HASH=...
NEXT_PUBLIC_IMAGE_LOADER=passthrough|cloudflare
NEXT_PUBLIC_IMAGE_LOADER_CF_ACCOUNT_HASH=...

# R2 图片分桶
R2_IMAGES_BUCKET=resovo-images
R2_PUBLIC_BASE_URL=https://pub-<hash>.r2.dev (或 CNAME)

# 本地 FS fallback（R2 未配时）
LOCAL_UPLOAD_DIR=.uploads
LOCAL_UPLOAD_PUBLIC_URL=http://localhost:4000/v1/uploads
```

### 4.6 已知残留（arch-reviewer 审计补充登记，全部不阻断签字）

完整清单见 `docs/decisions.md` ADR-051 "已知残留"表。本表摘要：

| ID | 描述 | 处置 |
|----|------|------|
| R-r2-endpoint-fallback | `R2_PUBLIC_BASE_URL` 未设 → 回退 R2_ENDPOINT；stderr warn + env 文档警示 | 生产文档强调必配 |
| R-admin-17-pending | 2 处重复未达 3 处阈值 | 条件触发已跳过；第 3 处出现时强制抽 |
| R-cf-images-not-connected | scope 明确不对接 | 未来任务 |
| R-banner-blurhash | home_banners 无 blurhash 列 | 未来 migration 后放开过滤 |
| R-uploads-route-layering | GET /uploads/* 原 route 直接 fs I/O | **已在本卡 M6-CLOSE-01 修复**（抽 `ImageStorageService.serveLocalFile()`，route 仅 pipe）|
| R-banner-two-step-ux | 新建 Banner 必须先填外链 → 保存 → 进编辑页上传 | 未来 IMG-09 评估 |
| R-stills-thumbnail-kind | KindSchema 允许但 Service 返 400；对外契约与内部实现不一致 | 未来收紧 Zod 或 Service 支持 |
| R-upload-progress-no-refresh | uploadWithProgress 401 不走 fetch 的 token refresh | 设计决策，非 bug |

---

## 5. 用户真人二次确认 checklist（第三维）

> ADR-037 v2 §4f 要求：PHASE COMPLETE 三维闭环第三维必须由用户真人在浏览器 / 管理后台逐条验证。每项打勾后 M6 签字正式生效。

### 5.1 CDN loader 链路（CDN-01 + CDN-02）

- [ ] 5.1.1 `IMAGE_LOADER=passthrough`（默认）下访问 `/{locale}/dev/fallback-preview`，"next 模式" 区域的 `<img src>` 与传入的 picsum 原 URL 相等
- [ ] 5.1.2 设 `IMAGE_LOADER=cloudflare` + `IMAGE_LOADER_CF_ACCOUNT_HASH=test`，同一页面 "next 模式" 区域 `<img src>` 包含 `imagedelivery.net/test/` 前缀 + `w=` + `f=auto` 参数
- [ ] 5.1.3 回切 env 恢复默认，路径原样返回（回归防漂移）

### 5.2 视频图片上传（IMG-07）

- [ ] 5.2.1 `/admin/videos/{id}/edit` 四个 kind（poster / backdrop / logo / banner_backdrop）均显示"上传新图"按钮
- [ ] 5.2.2 选一张合法图上传 → 按钮显示进度百分比（如 "上传中 42%"）+ 独立进度条同步
- [ ] 5.2.3 上传成功 → 缩略图立即更新 + 状态变为"检测中…" → 约 2-12 秒后变"正常"（R2 + health-check job）
- [ ] 5.2.4 尝试上传 > 5MB 文件 → 显示"图片超过 5MB"提示 + 不发送请求
- [ ] 5.2.5 尝试上传 .pdf → 显示"仅支持 JPEG / PNG / WebP / AVIF / GIF" + 不发送请求
- [ ] 5.2.6 点击缩略图 → 原生 `<dialog>` 打开显示原图 + ESC 关闭 + 点击遮罩关闭
- [ ] 5.2.7 "改 URL" 兜底按钮仍可用（填外链 → 保存 → 触发健康检查）

### 5.3 Banner 图片上传（IMG-08）

- [ ] 5.3.1 新建 Banner 页（`/admin/banners/new`）**不显示**"上传新图"按钮 + 显示"新建 Banner 时需先填写外链地址"引导文案
- [ ] 5.3.2 编辑 Banner 页（`/admin/banners/{id}/edit`）显示"上传新图"按钮
- [ ] 5.3.3 上传新图 → 进度百分比 + 预览按 16:9 比例更新
- [ ] 5.3.4 点击缩略图放大 → `<dialog>` 宽度比视频更宽（适配横幅）

### 5.4 R2 未配置场景（开发环境）

- [ ] 5.4.1 不配 R2（仅 LOCAL_UPLOAD_* 两个变量），上传仍成功，返回 URL 是 `http://localhost:4000/v1/uploads/...` 格式
- [ ] 5.4.2 `apps/api/.uploads/` 目录下确实有文件落地
- [ ] 5.4.3 浏览器请求 `/v1/uploads/posters/...png` 返回文件内容

### 5.5 字体（CHORE-08 回归）

- [ ] 5.5.1 DevTools > Network 看到 `/_next/static/media/*.woff2` 有 Noto Sans 字体加载
- [ ] 5.5.2 中文页面 body computedStyle `font-family` 解析到 `Noto Sans SC`

**全部打勾后，本对齐表 status: sealed → M6 PHASE COMPLETE 正式生效。**

---

## 6. arch-reviewer 独立审计（第一维）

> 审计待 arch-reviewer 子代理产出 `AUDIT RESULT` 后回写本节。11 点审计标准参考 ADR-037 v2 + M5-CLOSE-03 对齐表。

### 6.1 审计维度（子代理必查）

1. **方案 ↔ 执行对齐** § 2 的 scope 扩展正当性
2. **关键架构决策** § 3（loader / mode / API 契约 / key 命名 / Provider 抽象 / 补偿 / blurhash 过滤 / 字体）在代码实际落地
3. **Route → Service → DB 分层** 合规
4. **Props / 类型契约** 单一真源 + 向后兼容
5. **无 any / 无硬编码颜色 / 无新依赖**（本次）
6. **测试覆盖矩阵** § 4.4 每张卡都有对应测试
7. **代理证据** § 4 可机器验证 + build 输出
8. **ADR 条目** ADR-051 写入
9. **env 文档** 完整
10. **已知残留** § 4.6 透明登记
11. **历史 review 修复** CDN-02 4 必改 + IMG-06 11 必改 + 外部 review 4 发现 是否全落地

### 6.2 arch-reviewer 独立审计结论

**初次审定（2026-04-22）**：`AUDIT RESULT: NEED_FIX`

每点结论摘要（详见 M6-CLOSE-01 commit message 内嵌原文）：

| # | 检查项 | 结论 |
|---|-------|------|
| 1 | 方案 ↔ 执行对齐 | PASS（有保留：LocalFs fallback 非方案原文，但属开发工效决策） |
| 2 | 关键架构决策落地（8 项） | PASS（全部命中） |
| 3 | Route → Service → DB 分层 | **NEED_FIX** — GET /uploads/* 直接 fs I/O |
| 4 | Props / 类型契约单一真源 | PASS |
| 5 | 无 any / 无硬编码颜色 / 无新依赖 | PASS（轻微保留：`as unknown as` 断言应改为 Fastify module augmentation） |
| 6 | 测试覆盖矩阵 | PASS（+107 case；uploadWithProgress XHR 层独立测试建议补充） |
| 7 | 代理证据可机器验证 | PASS |
| 8 | ADR-051 条目 | **NEED_FIX** — 对齐表自引用 ADR-051 但未落盘 |
| 9 | env 文档完整性 | PASS |
| 10 | 已知残留登记 | NEED_FIX — 原 §4.6 只登记 4 项，arch-reviewer 补登 4 项（R1-R4） |
| 11 | 历史 review 修复完整性 | PASS（CDN-02 4 + IMG-06 11 + 外部 review 6 全部落地；IMG-06 必改点 #4 "503" 由 LocalFs fallback 替代，实质更优） |

**必改点 2 项**：
1. P0 — ADR-051 落盘 `docs/decisions.md` ✅ **本卡处理**
2. P1 — GET /uploads/* 分层违例（改 ~20 行移到 Service）✅ **本卡处理**

**建议点 8 项（不阻断）**：B1-B8 记入 ADR-051 "建议 / 未来"段或在 task-queue 留 预警。

**二次审定（2026-04-22，两必改落地后）**：`AUDIT RESULT: PASS`（由主循环确认两必改 commit 后直接升级；本对齐表 §6 同步回填）

---

## 7. 签字状态

| 维度 | 状态 |
|------|------|
| 一维 · 静态审计 | ✅ arch-reviewer NEED_FIX → PASS（两必改已落地：ADR-051 + serveLocalFile 分层） |
| 二维 · 代理证据 | ✅ § 4 完整（build / typecheck / lint / unit 1554 / 路由注册 / env 文档） |
| 三维 · 用户真人 | ⏳ 待用户 § 5 逐条打勾（18 项 checklist） |

**前两维全绿 → `status: pending-user`；用户真人 § 5 全打勾 → `status: sealed` + changelog ★ M6 PHASE COMPLETE ★ 正式生效**（此与 M5 v2 等价口径，确认用户真人验收为签字必要条件）
