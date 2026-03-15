# Resovo（流光） — 开发路线图

> 本文件定义四个开发阶段的目标和功能模块边界。
> 每个 Phase 完成时在对应里程碑处打勾，并在 changelog.md 记录。

---

## Phase 1 — MVP 上线
**目标**：核心功能可用，能让用户搜索和播放视频

### 基础设施
- [ ] INFRA-01 项目初始化（Next.js + Fastify monorepo 结构）
- [ ] INFRA-02 PostgreSQL 数据库初始化（建表 + 索引）
- [ ] INFRA-03 Elasticsearch 初始化（创建索引 + mapping）
- [ ] INFRA-04 Redis 初始化（连接 + 基础配置）
- [ ] INFRA-05 环境变量与配置管理
- [ ] INFRA-06 Docker Compose 本地开发环境

### 认证模块
- [ ] AUTH-01 用户注册接口（POST /auth/register）
- [ ] AUTH-02 用户登录接口（POST /auth/login）
- [ ] AUTH-03 Token 刷新接口（POST /auth/refresh）
- [ ] AUTH-04 登出接口（POST /auth/logout + Redis 黑名单）
- [ ] AUTH-05 前端登录/注册页面与表单

### 视频内容模块
- [ ] VIDEO-01 视频列表接口（GET /videos）
- [ ] VIDEO-02 视频详情接口（GET /videos/:id）
- [ ] VIDEO-03 热门榜单接口（GET /videos/trending）
- [ ] VIDEO-04 首页布局组件（HeroBanner + 横向卡片列表）
- [ ] VIDEO-05 视频卡片组件（VideoCard）

### 搜索模块
- [ ] SEARCH-01 全文搜索接口（GET /search）含 director/actor/writer 过滤
- [ ] SEARCH-02 搜索联想接口（GET /search/suggest）
- [ ] SEARCH-03 搜索页面（顶部筛选栏 + 结果列表）
- [ ] SEARCH-04 MetaChip 可点击组件

### 播放器模块
- [ ] PLAYER-01 播放器容器（PlayerShell）+ Video.js 集成
- [ ] PLAYER-02 HLS.js 流媒体支持
- [ ] PLAYER-03 控制栏（ControlBar）— 左侧：播放/暂停、下一集、音量
- [ ] PLAYER-04 控制栏右侧：字幕 CC 面板、倍速面板、剧场模式、全屏
- [ ] PLAYER-05 下一集悬停 → 选集按钮滑出 + 选集浮层（EpisodeOverlay）
- [ ] PLAYER-06 快捷键绑定（Space/方向键/T/F/C/M/I 等）
- [ ] PLAYER-07 弹幕条（DanmakuBar）— Bilibili 风格
- [ ] PLAYER-08 Default/Theater Mode 布局切换
- [ ] PLAYER-09 播放源列表接口（GET /videos/:id/sources）

### 爬虫基础
- [ ] CRAWLER-01 Bull 队列基础设施（crawler-queue + verify-queue + worker 骨架）
- [ ] CRAWLER-02 苹果CMS采集服务（接口对接 + XML/JSON 解析 + 字段映射 + 去重写库）
- [ ] CRAWLER-03 链接验证服务（HEAD 检测 + is_active 维护 + 定时任务）
- [ ] CRAWLER-04 管理后台接口（手动触发采集、链接验证、用户投稿）

**Phase 1 里程碑**：用户可以通过分类浏览或搜索找到视频，点击详情页后进入播放页观看，弹幕飞行；爬虫可以从苹果CMS接口自动采集内容

---

## Phase 2 — 社区功能 + 管理后台
**目标**：用户可以参与互动；管理员可以通过后台管理内容和系统

### 管理后台（ADMIN 模块）
- [ ] ADMIN-01 后台访问控制中间件（/admin 路径守卫、侧边栏按角色分区）
- [ ] ADMIN-02 视频内容管理页面（上下架、编辑元数据、手动添加）
- [ ] ADMIN-03 播放源 + 投稿 + 字幕审核页面
- [ ] ADMIN-04 用户管理 + 爬虫管理页面（admin only）
- [ ] ADMIN-05 数据看板（admin only）

### 用户功能
- [ ] USER-01 个人中心页面
- [ ] USER-02 更新用户信息接口（PATCH /users/me）
- [ ] USER-03 收藏功能（GET/POST /users/me/favorites）
- [ ] USER-04 观看历史（GET/POST /users/me/history）含播放进度

### 评论与弹幕
- [ ] SOCIAL-01 评论列表接口（GET /videos/:id/comments）
- [ ] SOCIAL-02 发表评论接口（POST /videos/:id/comments）含回复
- [ ] SOCIAL-03 弹幕接口（GET/POST /videos/:id/danmaku）
- [ ] SOCIAL-04 举报失效源接口（POST /videos/:id/sources/:id/report）

### 播放列表
- [ ] LIST-01 播放列表 CRUD 接口（GET/POST/PATCH/DELETE /lists）
- [ ] LIST-02 列表视频管理（添加/移除/拖拽排序）
- [ ] LIST-03 播放列表页面（公开/私密切换）
- [ ] LIST-04 视频详情页"加入播放列表"按钮

### 资源投稿
- [ ] CONTRIB-01 用户投稿资源链接接口（POST /admin/sources/submit）
- [ ] CONTRIB-02 投稿自动验证队列任务
- [ ] CONTRIB-03 字幕上传接口（POST /videos/:id/subtitles）

**Phase 2 里程碑**：用户登录后有完整的社交参与体验；管理员可通过后台管理内容上下架和系统配置

---

## Phase 3 — 内容增强
**目标**：内容质量和发现体验大幅提升

### 片单
- [ ] COLL-01 片单 CRUD 接口（admin/editor 权限）
- [ ] COLL-02 片单详情页（封面拼贴 + 介绍 + 视频列表）
- [ ] COLL-03 片单点赞功能
- [ ] COLL-04 首页片单推荐区块

### 推荐系统
- [ ] REC-01 相关视频推荐接口（GET /videos/:id/related）
- [ ] REC-02 基于标签的相似度推荐
- [ ] REC-03 基于观看历史的个性化推荐（协同过滤初版）

### 国际化
- [ ] I18N-01 next-intl 接入，路由国际化（/en/、/zh-CN/）
- [ ] I18N-02 中英日三语 UI 翻译文件
- [ ] I18N-03 字幕语言切换（CC 面板多语言字幕加载）

**Phase 3 里程碑**：平台具备国际化能力，内容发现体验接近成熟产品

---

## Phase 4 — 平台扩展
**目标**：运营能力、数据能力、开放能力

### 社交推送
- [ ] PUSH-01 Discord Webhook 集成（新片上线推送）
- [ ] PUSH-02 Telegram Bot 集成
- [ ] PUSH-03 X (Twitter) API 集成
- [ ] PUSH-04 推送任务调度（Bull + 定时触发）

### 数据统计
- [ ] ANALYTICS-01 管理员数据看板页面
- [ ] ANALYTICS-02 播放量/来源/留存统计接口
- [ ] ANALYTICS-03 用户画像分析（地区、语言、设备）

### API 开放平台
- [ ] OPEN-01 开放 API 文档（基于 SDD 接口规范）
- [ ] OPEN-02 API Key 管理（申请/限流/统计）

### PWA
- [ ] PWA-01 Service Worker 配置
- [ ] PWA-02 离线收藏列表（不含离线播放）
- [ ] PWA-03 移动端安装提示

**Phase 4 里程碑**：平台具备完整的运营和开放能力
