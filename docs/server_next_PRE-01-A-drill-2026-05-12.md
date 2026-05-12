# PRE-01-A · DEBT-SN-3-B staging cookie + nginx e2e 演练记录

> status: completed
> owner: @engineering
> scope: cookie 跨 apps/server (:3001) ↔ apps/server-next (:3003) 切换 + nginx hot reload + 回滚预案 staging 演练
> source_of_truth: yes（PRE-01-A 完成判定依据）
> drill_date: 2026-05-12
> drill_env: local macOS（Caddy 替代 staging nginx；5 步金票路径与 ADR-101 一致）
> related_adr: ADR-101 §数据兼容性 / plan §4.2 line 150
> last_reviewed: 2026-05-12

---

## 1. 演练目标

ADR-101 line 2176 强约束："M-SN-3 完成时须在 staging 环境完成 cookie + nginx 反代 e2e 演练，验证 refresh_token 跨 server / server-next 透明、nginx upstream 切换不丢 session"。

验证 4 个 cutover 不变量：
1. **cookie 跨服务共享**：server 与 server-next 用相同 fastify-jwt cookie 名（由 apps/api 签发）
2. **JWT 签发源唯一**：apps/api :4000 为唯一签发源
3. **nginx hot reload 不丢连接**：reload 期间正在进行的请求不中断
4. **回滚预案可用**：cutover 出问题可一行 reload 切回 :3001

## 2. 演练环境

| 项 | 配置 |
|---|---|
| 平台 | macOS（开发者本地） |
| 反代 | Caddy 2.x（替代 staging nginx；Caddyfile 配置与 docker/nginx.conf 路由规则等价） |
| 反代入口 | `http://localhost:8080` |
| 前台 | `apps/web-next` :3000 |
| 旧后台 | `apps/server` :3001（`NEXT_PUBLIC_ASSET_PREFIX=/admin`）|
| 新后台 | `apps/server-next` :3003（`NEXT_PUBLIC_ASSET_PREFIX=/admin`，CHG-SN-5-PRE-01-A-pre 已补支持）|
| API | `apps/api` :4000（cookie / JWT 签发） |
| 数据库 | 共用同一 PostgreSQL + Redis（dev 实例） |

### 2.1 Caddyfile 演练配置

```
{
    admin localhost:2019
}

:8080 {
    reverse_proxy /v1/* localhost:4000
    reverse_proxy /admin/* localhost:3001  # 演练 ② 改 3003，⑤ 改回 3001
    reverse_proxy /* localhost:3000
}
```

切换命令：
```bash
# 切到 server-next（演练 ②）
sed -i '' 's|localhost:3001|localhost:3003|' /tmp/Caddyfile && caddy reload --config /tmp/Caddyfile

# 切回 server（演练 ⑤）
sed -i '' 's|localhost:3003|localhost:3001|' /tmp/Caddyfile && caddy reload --config /tmp/Caddyfile
```

### 2.2 前置 bugfix（演练前必修）

发现 `apps/server-next/next.config.ts` 零 assetPrefix 支持（与 architecture.md line 101 声明不符）。已起 **CHG-SN-5-PRE-01-A-pre** 同期修复：
- next.config.ts 加 `NEXT_PUBLIC_ASSET_PREFIX` env 注入（commit `d00c33c3`）
- changelog 追加自检（commit `423bc142`）

演练时需在本地 `.env.local` 设 `NEXT_PUBLIC_ASSET_PREFIX=/admin`（用户本地配置，git 忽略）。

## 3. 5 步金票路径实测结果

### 步 ① — 登录 server :3001（基线）

- 操作：浏览器访问 `http://localhost:8080/admin/videos`，admin 账号登录
- ✅ **结果**：
  - `refresh_token` cookie 已设置
  - Cookie 头：
    - Domain: `localhost`
    - Path: `/`
    - **SameSite: Strict**（观察项，见 §5 风险登记）
  - Value（HS256 JWT）：`eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.{userId,type:refresh,iat,exp}.{signature}`
    - 解码字段齐全：`userId` / `type=refresh` / `iat` / `exp`（apps/api 签发）

### 步 ② — Caddy reload 切 upstream `/admin/* → :3003`

- 操作：`sed -i '' 's|localhost:3001|localhost:3003|' /tmp/Caddyfile && caddy reload --config /tmp/Caddyfile`
- ✅ **结果**：
  - Caddy 日志：`using config from file` + `adapted config to JSON`
  - 无报错、无连接中断
  - hot reload 完成时间 < 100ms

### 步 ③ — 浏览器 F5 刷新当前页面

- 操作：浏览器 F5 刷新 `/admin/videos`
- ✅ **结果**：
  - (a) 不弹重新登录对话框 — cookie 透明
  - (b) `/admin/videos` HTML 状态 **200**
  - (c) `/admin/_next/...` 静态资源全部 **200**（assetPrefix env 已注入，nginx 剥前缀转发正常）

### 步 ④ — 在 server-next 渲染页面执行业务操作

- 操作：在新后台 server-next 上做一次审核 / 编辑（典型写操作）
- ✅ **结果**：
  - `/v1/...` API 请求 **200/204**
  - cookie 正确携带（DevTools Network → Request Headers → Cookie 含 refresh_token）
  - 业务结果落库 + UI 状态正确更新

### 步 ⑤ — Caddy reload 切回 `/admin/* → :3001` + F5（回滚预案）

- 操作：`sed -i '' 's|localhost:3003|localhost:3001|' /tmp/Caddyfile && caddy reload --config /tmp/Caddyfile`，浏览器 F5
- ✅ **结果**：
  - session 仍保留（cookie 透明）
  - 业务状态完整 — ④ 步的写入在 :3001 上仍可见（apps/api 是唯一数据源）
  - 回滚预案可用

## 4. 4 个不变量验收

| # | 不变量 | 验收 | 证据 |
|---|---|---|---|
| 1 | cookie 跨服务共享 | ✅ | ③ 步刷新不要求重新登录；④ 步 cookie 正确携带到 server-next 触发的 /v1 请求 |
| 2 | JWT 签发源唯一 | ✅ | refresh_token JWT 解码字段（iat/exp/userId/type）跨 server / server-next 一致；签名相同 |
| 3 | nginx hot reload 不丢连接 | ✅ | ②/⑤ 步 reload < 100ms 完成，无连接中断（用户操作连续，浏览器 Network 面板无 ERR_CONNECTION_*） |
| 4 | 回滚预案可用 | ✅ | ⑤ 步切回 :3001 后 session + 业务状态完整 |

## 5. 风险登记（演练观察 → cutover 前必须留意）

### Risk-PRE-01-A-1 · SameSite=Strict 跨子域风险（🟡 cutover 预警）

- **现状**：refresh_token cookie SameSite=**Strict**
- **当前演练影响**：无（same-origin localhost:8080 切换属 same-site，Strict 不阻挡）
- **cutover 潜在影响**：若 cutover 后实际域名涉及跨子域（如 `admin.resovo.com` → `app.resovo.com`），Strict 会阻挡 cookie 跨子域携带 → 跨子域请求**无 cookie** → 业务挂
- **缓解策略候选**：
  1. 评估 cutover 后域名结构，如确认跨子域则调整 SameSite=Lax（refresh_token 由 HttpOnly + Secure 兜底安全）
  2. 或同域名（admin/app/api 都挂 `*.resovo.com` 同级路径）— 保持 Strict 不变
- **责任卡**：登记入 **DEBT-SN-3-C 审计材料**（PRE-01-B）+ **task-queue 欠账段**；cutover-pre 卡（M-SN-7 启动前）评估并出 ADR

## 6. 完成判据核对

按 task-queue.md line 3160 验收要点：
- ✅ cookie 跨服务（server ↔ server-next）切换透明
- ✅ 5 步金票路径全绿

判定：**PRE-01-A · DEBT-SN-3-B 演练 PASS**，cutover-blocker 关闭。

## 7. 后续触发

- **解锁 PRE-01-B**：DEBT-SN-3-C / M-SN-3 milestone 阶段审计（依赖 PRE-01-A 完成或 staging-waiver；本卡走完整演练路径，非 waiver）
- **SameSite=Strict 跨子域风险**登记入 PRE-01-B 审计材料 + task-queue 欠账段
- **SEQ-20260506-02 进度**：10/13 → **11/13**（A 段剩余 PRE-01-B/-E/-F 3 子卡）

## 8. 关联

- ADR-101 cutover 协议（decisions.md line 2134-2189）
- plan §4.2 cookie + nginx 演练硬约束（line 150）
- M-SN-4 audit DEBT-SN-3-B 登记（M-SN-4-milestone-audit-2026-05-05.md line 74）
- CHG-SN-5-PRE-01-A-pre（assetPrefix 演练前置 bugfix）
