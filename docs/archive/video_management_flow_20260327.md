# 视频治理与管理方案流程图与界面功能明细表 (2026-03-27)

> status: archived
> owner: @engineering
> scope: video governance lifecycle flow reference
> source_of_truth: no
> supersedes: none
> superseded_by: none
> last_reviewed: 2026-03-27


为了清晰展现视频治理方案的全貌，本文档将各个后台界面的具体功能职责进行了模块化拆解，并提供了一份理想的视频治理全生命周期流程图。

## 一、 三大核心界面的具体功能分解

### 1. 内容审核台 (Moderation Dashboard)
**定位**：针对非信任源采集的内容进行“流水线式”的高效加工与过滤。
* **分发与过滤**：只展示 `review_status = pending_review` 的视频。
* **沉浸式评审面板**：
  * **快速阅读**：高亮展示容易违规的字段（标题、标签、简介描述、源采集站）。
  * **内置直连试播**：调起播放器播放影片片段，用于快速排查低劣画质或博彩水印。
* **流转操作组（支持键盘快捷键）**：
  * `【通过并上架 Approve】`：状态转为 `approved` + `public`。
  * `【低质拒绝 Reject】`：状态转为 `rejected` + `hidden`（不封锁，但不上架）。
  * `【违规封杀 Block】`：状态转为 `blocked` + `blocked`（打入黑名单，系统此后拒收相同内容）。

### 2. 全量视频治理库 (Video Inventory Management)
**定位**：针对全站所有历史影视作品的宏观“进销存”管理与人工精细化调整。
* **复杂组合查阅**：支持按 ID、精确片名、已上架/已下架、内容分类等进行交集过滤。
* **元数据全量编辑**：管理员可手动修改标题、影视海报、演职员名单等元数据。
* **源与剧集管理编排**：查看剧集关联列表及对应的第三方物理链接 (`source_url`)。
* **灵活批处理（Batch Actions）**：支持批量上架、批量下架。
* **健康度前置警示**：若某视频所有源都死亡失效，列表处闪烁红灯徽章警示，提示需介入干预。

### 3. 视频源与健康度监控中心 (Source Health Center)
**定位**：解决“空壳视频”（点开无法播放）的用户体验灾难，专门处理死链与纠错。
* **“孤岛视频”捕获网络**：自动列出“处于 Public 状态但经检测所有播放源皆无效”的视频列表。
* **源一键替换工作流 (URL Replace)**：发现新源后，填入面板直接替换原老旧/失效 URL。
* **用户报错工单审理**：
  * 处理前端用户提交的“该视频无法播放”的投诉。
  * 审阅用户志愿上传的新源链接，支持一键 `[采纳为有效源]` 或 `[驳回]`。
* **异步源测活工具**：支持批量发起的 `HTTP HEAD` 状态死链检查。

---

## 二、 视频治理全生命周期流程图 (Ideal Flow)

以下展示了从爬虫抓取到 C 端展示的防御、自动巡航与人工干预工作流：

```mermaid
graph TD
    classDef autoProcess fill:#e1f5fe,stroke:#01579b,stroke-width:2px;
    classDef manualProcess fill:#fff3e0,stroke:#e65100,stroke-width:2px;
    classDef statePublic fill:#e8f5e9,stroke:#2e7d32,stroke-width:2px;
    classDef stateHidden fill:#ffebee,stroke:#c62828,stroke-width:2px;

    A([爬虫 Worker 抓取]) --> B{源站的 Ingest Policy 是什么?}
    
    %% 高信赖站
    B -- "allow_auto_publish=true" --> C:::autoProcess
    C[系统自动通过] --> D((视频公开库 Public)):::statePublic
    
    %% 非信赖站
    B -- "allow_auto_publish=false" --> E[拦截：进入审核列队]:::manualProcess
    E --> F{"内容审核台\n(人工/快捷键审核)"}
    
    F -- "🔴 涉黄/暴恐/广告" --> G((黑名单区 Blocked)):::stateHidden
    F -- "🟢 安全/高质" --> D
    
    %% 管理端维护
    D -- "版权要求/暂时隐蔽" --> H{"全量库管理面板\n(人工操作)"}:::manualProcess
    H -- "点击下架" --> I((临时下架池 Hidden)):::stateHidden
    I -- "重获版权/再次发布" --> H
    H -- "点击上架" --> D
    
    %% 健康度
    D -. "用户播放..." .-> J{健康度监控中心}:::manualProcess
    J -- "用户报错: 所有源集体失效 / 死链" --> K[触发全局告警下架]:::autoProcess
    K --> I
    
    J -- "用户/管理员提交新源补位" --> L[源审核与替换 (URL Replace)]:::manualProcess
    L -- "验证有效" --> D
```
