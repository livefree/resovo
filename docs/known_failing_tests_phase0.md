# 已知失败测试隔离清单 — Phase 0

> 适用阶段：Phase 0（2026-04-18 起）
> 更新协议：每进入新 Phase 只能缩小不能增长；新增失败必须在本 Phase 内修复或创建 CHG-NN 任务
> 关联文档：`docs/test_triage_20260418.md`，`docs/baseline_20260418/failing_tests.json`

---

## 说明

- 单元测试：经 TESTFIX-05 修复后 **0 条**失败，本清单无单元测试条目
- E2E 测试：54 条（C×47 + D×7），全部 defer 到对应里程碑，进入本清单
  - TESTFIX-07 重建后从原 9 条扩展至 54 条（补全 homepage / auth / admin / admin-source / publish-flow / video-governance 六个 suite）
- CI `test:guarded` 运行单元测试时，清单外新增失败 → 退出码 1（阻断 merge）

---

## 隔离 ID 列表（E2E）

```json
[
  "e2e::homepage.spec.ts::首页::导航栏显示分类标签",
  "e2e::homepage.spec.ts::首页::底部免责声明常驻显示",
  "e2e::homepage.spec.ts::首页::未登录时显示Sign In按钮",
  "e2e::homepage.spec.ts::语言切换::切换到中文后页面为中文内容",
  "e2e::homepage.spec.ts::语言切换::切换回英文后页面为英文内容",
  "e2e::homepage.spec.ts::导航跳转::点击Sign In跳转到登录页",
  "e2e::auth.spec.ts::登录页::登录页正常加载显示账号和密码输入框",
  "e2e::auth.spec.ts::登录页::空表单提交显示必填验证错误",
  "e2e::auth.spec.ts::登录页::空账号提交显示账号必填错误",
  "e2e::auth.spec.ts::登录页::用户完成登录后跳转到首页",
  "e2e::auth.spec.ts::登录页::登录后导航栏显示用户名",
  "e2e::auth.spec.ts::登录页::登录失败401显示错误提示",
  "e2e::auth.spec.ts::登录页::点击注册链接跳转到注册页",
  "e2e::auth.spec.ts::注册页::注册页正常加载显示三个输入框",
  "e2e::auth.spec.ts::注册页::空表单提交显示用户名必填错误",
  "e2e::auth.spec.ts::注册页::密码少于8位显示密码长度错误",
  "e2e::auth.spec.ts::注册页::用户完成注册后跳转到首页",
  "e2e::auth.spec.ts::注册页::注册后导航栏显示用户名",
  "e2e::auth.spec.ts::注册页::重复邮箱422CONFLICT显示冲突错误",
  "e2e::auth.spec.ts::注册页::点击登录链接跳转到登录页",
  "e2e::auth.spec.ts::登出流程::登出后导航栏不显示用户名",
  "e2e::player.spec.ts::电影详情页::立即观看按钮指向播放页",
  "e2e::player.spec.ts::动漫详情页（多集）::点击第 3 集跳转到播放页 ep 3",
  "e2e::player.spec.ts::播放页（PlayerShell）::标题链接指向详情页",
  "e2e::player.spec.ts::播放页（PlayerShell）::剧场模式切换按钮可见（大屏设备）",
  "e2e::player.spec.ts::播放页（多集动漫）::显示右侧选集面板",
  "e2e::player.spec.ts::播放页（多集动漫）::选集面板显示正确数量",
  "e2e::player.spec.ts::PLAYER-10 播放页完整链路::DanmakuBar 存在于播放页中（data-testid=danmaku-bar）",
  "e2e::search.spec.ts::分类浏览页::点击类型筛选后结果更新（只显示该类型）",
  "e2e::search.spec.ts::搜索页::点击结果卡片跳转到播放页",
  "e2e::admin.spec.ts::权限控制::未登录访问/admin重定向到登录页",
  "e2e::admin.spec.ts::权限控制::未登录访问/admin/videos重定向到登录页",
  "e2e::admin.spec.ts::权限控制::role=user访问/admin重定向到403页面",
  "e2e::admin.spec.ts::权限控制::role=user访问/admin/videos重定向到403页面",
  "e2e::admin.spec.ts::权限控制::role=moderator访问/admin/users重定向到403",
  "e2e::admin.spec.ts::权限控制::role=moderator访问/admin/crawler重定向到403",
  "e2e::admin.spec.ts::权限控制::role=moderator访问/admin/analytics重定向到403",
  "e2e::admin.spec.ts::侧边栏::admin侧边栏显示系统管理区",
  "e2e::admin.spec.ts::侧边栏::admin侧边栏有返回前台链接",
  "e2e::admin.spec.ts::侧边栏::moderator侧边栏同样有返回前台链接",
  "e2e::admin.spec.ts::视频管理::视频列表页渲染并显示状态筛选器",
  "e2e::admin.spec.ts::视频管理::点击上架触发PATCH请求",
  "e2e::admin.spec.ts::投稿审核::投稿审核页面显示待审列表",
  "e2e::admin.spec.ts::投稿审核::点击通过触发approve请求",
  "e2e::admin.spec.ts::字幕审核::字幕审核页面显示待审列表",
  "e2e::admin.spec.ts::用户管理::用户管理页面显示用户列表",
  "e2e::admin.spec.ts::用户管理::点击封号触发ban请求",
  "e2e::admin.spec.ts::采集控制台::采集控制台触发入口位于sites_tab",
  "e2e::admin-source-and-video-flows.spec.ts::视频操作::video_actions_dropdown_triggers_publish_and_douban_sync",
  "e2e::admin-source-and-video-flows.spec.ts::审核流程::moderation_reject_submits_reason",
  "e2e::publish-flow.spec.ts::发布流程::管理员在视频列表中发布待审核视频状态变为已上架",
  "e2e::publish-flow.spec.ts::搜索验证::点击搜索结果进入详情页基本信息可见",
  "e2e::video-governance.spec.ts::审核快捷键::happy_path_入库后在审核台按快捷键通过",
  "e2e::video-governance.spec.ts::审核快捷键::reject_path_入库后在审核台按快捷键拒绝"
]
```

---

## 处置计划（分里程碑）

| 里程碑 | 条数 | 类型 | 内容 |
|--------|------|------|------|
| M2 | 4 | C | homepage nav testids、search result-count、publish-flow detail page |
| M3 | 8 | C | player href 格式（×2）、PlayerShell testids（×5）、search result-card href |
| M4 | 15 | C | auth 登录/注册表单所有 ID/testid |
| M5 | 1 | C | danmaku-bar（弹幕重新接入）|
| M6 | 16 | C | admin 权限重定向 URL、侧边栏 testids、各管理页列表 testids、video-governance shortcut |
| TESTFIX-08 | 7 | D | admin publish/approve/ban 超时、admin-source dropdown/reject 超时、publish-flow 发布超时、video-governance reject 超时 |
