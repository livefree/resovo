# Resovo（流光）— 采集域 Admin 导航收归设计方案

> status: archived
> owner: @engineering
> scope: crawler domain navigation consolidation plan reference
> source_of_truth: no
> supersedes: none
> superseded_by: none
> last_reviewed: 2026-03-27


> 对应决策：ADR-014
> 任务入口：SEQ-20260322-10（CHG-169）
> 本文档描述问题背景、目标架构、改动范围与回滚策略，不含实现细节代码。

---

## 一、问题背景

### 1.1 现状：采集域被错误拆分到两个导航区

采集生命周期的所有数据属于同一个业务域：

```
crawler_sites   → 采集源站配置
crawler_runs    → 批次执行记录
crawler_tasks   → 单站任务记录
crawler_task_logs → 任务日志
```

但在 admin 导航中，这些内容分散在两个互不相关的区域：

| 导航位置 | 内容 | 与采集域的关系 |
|---------|------|--------------|
| `/admin/crawler` | 采集控制台（runs/tasks/advanced tabs） | ✅ 正确归属 |
| `/admin/system/sites` | `crawler_sites` 管理 | ❌ 错误归属，应在 crawler 区 |
| `/admin/system/config` | 含爬虫 API 配置段（api_site JSON） | ❌ 错误归属，应在 crawler 区 |
| `/admin/system/monitor` | 含采集监控面板 | ❌ 混入，应分离 |

### 1.2 问题影响

**操作流程被打断**：一个完整的"添加源站 → 触发采集 → 查任务日志"流程需要在两个导航区之间跳转：

```
/admin/system/sites   （添加/配置源站）
     ↓ 需要手动切换导航
/admin/crawler        （触发采集，查看 runs/tasks）
     ↓ 需要手动切换导航
/admin/system/monitor  （看监控面板）
```

**新页面归属不清晰**：后续治理层升级（审核队列、ingest policy 配置）将新增多个采集相关 admin 页面，在导航结构混乱时，这些页面的归属会继续发散。

---

## 二、目标架构

### 2.1 导航重组后的结构

```
/admin/crawler                         ← 采集域统一入口
  ├── Tab: Sites（站点）               ← 原 /admin/system/sites 内容
  ├── Tab: Console（控制台）           ← 原有 runs/tasks/advanced
  ├── Tab: Logs（日志）                ← crawler_task_logs 查询
  └── Tab: Settings（设置）            ← 原 /system/config 中的爬虫配置段
                                          + 调度设置（auto-config）

/admin/system                          ← 仅保留纯系统配置
  ├── config                           ← 去掉爬虫配置段后的系统参数
  ├── monitor                          ← 应用级监控（CPU/内存/Redis/ES 健康），不含采集数据
  ├── cache
  └── migration
```

### 2.2 原路由处理

| 原路由 | 处理方式 | 理由 |
|-------|---------|------|
| `/admin/system/sites` | HTTP 307 redirect → `/admin/crawler?tab=sites` | 保持向后兼容，书签/直链不失效 |
| `/admin/system/config`（爬虫段） | 从页面中删除该 UI 段，仅保留非爬虫系统参数 | 内容迁移，不做 redirect |
| `/admin/system/monitor`（采集面板） | 采集监控面板移入 `/admin/crawler` Settings tab 或 Console tab | 内容迁移 |

### 2.3 /admin/crawler 四 tab 职责边界

| Tab | 主要内容 | 来源组件 |
|-----|---------|---------|
| Sites | crawler_sites 列表、CRUD、ingest_policy 编辑、单站触发采集 | `CrawlerSiteManager`（现在 `system/crawler-site/`） |
| Console | crawler_runs 批次状态、crawler_tasks 任务记录、全局控制（stop-all/freeze/orphan） | `AdminCrawlerPanel`、`CrawlerRunPanel` |
| Logs | crawler_task_logs 查询（可按 site/task/level 过滤） | 当前分散在 Console 内，独立为 tab |
| Settings | 自动采集调度配置（auto-config）、爬虫 API 配置（api_site JSON）、全局 freeze 开关 | `AutoCrawlSettingsPanel`、原 `ConfigFileEditor` 的爬虫段 |

---

## 三、改动范围与边界

### 3.1 只改路由和导航，不改业务逻辑

本次改动**严格限定**在：
- 路由文件（page.tsx）
- 导航组件（侧边栏菜单）
- Tab 定义与内容组装

`CrawlerSiteManager`、`AdminCrawlerPanel`、`CrawlerRunPanel`、`AutoCrawlSettingsPanel` 等业务组件**不做任何修改**，只是被重新引用到新的路由位置。

### 3.2 涉及文件清单

| 文件 | 操作 |
|------|------|
| `src/app/[locale]/admin/system/sites/page.tsx` | 改为 redirect 组件（Next.js `redirect()`） |
| `src/app/[locale]/admin/crawler/page.tsx` | 新增 Sites tab，重新排列 tab 顺序 |
| `src/app/[locale]/admin/system/config/page.tsx` | 删除爬虫配置 UI 段（`ConfigFileEditor` 中的爬虫相关 section） |
| `src/app/[locale]/admin/system/monitor/page.tsx` | 移除采集监控面板，改为纯应用级监控 |
| Admin 侧边栏导航组件 | system 区移除"站点"入口；crawler 区展示四个 tab 标识 |

### 3.3 不在本次改动内的内容

- Logs tab 的独立实现（crawler_task_logs 查询 UI）：当前日志查看功能已内嵌于 Console tab，独立 tab 可在后续任务中实现，本次仅预留 tab 位置（显示"即将上线"占位）
- `/admin/system/monitor` 的完整重建（应用级监控）：本次只做内容移除，不做新监控面板建设

---

## 四、回滚策略

### R1：redirect 安全
`/admin/system/sites` → redirect，不删除路由文件，随时可改回正常页面。

### R2：组件无修改
所有业务组件原封不动，若导航改动有问题，只需回退路由文件和导航组件，所有功能立即恢复。

### R3：配置段剥离
`/system/config` 中的爬虫配置段移除后，`system_settings` 表中的 `api_site` key 数据不变，数据不丢失。若需恢复入口只需在 config 页面重新引用组件。

---

## 五、验收标准

1. `/admin/crawler?tab=sites` 正常展示 crawler_sites 管理界面，行为与原 `/admin/system/sites` 完全一致
2. 访问 `/admin/system/sites` 自动跳转到 `/admin/crawler?tab=sites`（307）
3. `/admin/system/config` 不再包含爬虫配置 UI 段
4. Admin 侧边栏：System 区无"站点"入口；Crawler 区显示 Sites/Console/Logs/Settings 四个 tab 标识
5. 全部现有功能（采集触发、状态查看、日志、stop-all、freeze）行为不回退
6. typecheck / lint / test:run 通过
