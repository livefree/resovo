# Resovo（流光） — 任务看板

> last_reviewed: 2026-05-05

---

## 进行中任务

### CHG-SN-4-10-B · visual baseline 第 9 张补全（路径 X 最小满足 plan §11.5 第 6 项）

- **状态**：🚧 部分完成（主循环已做 DEBT-SN-4-A 转登记 + 验收 8 张；等待用户截 1 张 lines-tab）
- **创建时间**：2026-05-05
- **执行模型**：claude-opus-4-7
- **方案**：路径 X（最小路径 + DEBT-SN-4-A 转 cutover 前）
- **依赖**：CHG-SN-4-10-A2 ✅

#### 决策依据

- plan §11.5 第 6 项 must："visual baseline 9 张 PNG 已 commit"
- 当前 8 张已 commit（7 moderation + 1 video-edit-drawer/01-videos-list.png）
- 缺 1 张：DEBT-SN-4-08-A 要求的 `video-edit-drawer-lines-tab.png`
- DEBT-SN-4-A（5 件下沉组件 ~12 张 Playwright `toHaveScreenshot()` baseline）转登记到 cutover 前任务列表，与 DEBT-SN-3-B/C 同模式（不阻塞本 milestone）

#### 主循环已做（无代码改动）

- ✅ 验收 8 张已存 PNG 命名规范一致 + 内容覆盖 plan §11.5 第 6 项语义
- ✅ DEBT-SN-4-A 转登记（task-queue.md M-SN-4 欠账区 + ADR 引用）
- ✅ 待办说明 + 截图操作指引（见下方）

#### 待用户操作（截 1 张图）

**截图清单**：

| # | 文件路径 | 内容描述 | 截图条件 |
|---|---|---|---|
| 1 | `tests/visual/video-edit-drawer/video-edit-drawer-lines-tab.png` | VideoEditDrawer 打开 + 切到 "线路" (Lines) Tab + 显示真实 sources 列表 | dev server 跑、登录 admin、视频库随机点一行打开 Drawer、切到 Lines Tab |

**操作步骤**：

```bash
# 1. 启动 dev server（如未启）
npm --workspace @resovo/server-next run dev   # http://localhost:3003
npm --workspace @resovo/api run dev           # http://localhost:4000

# 2. 浏览器登录 http://localhost:3003/login
# 3. 进入 /admin/videos，点任意一行的"编辑"打开 VideoEditDrawer
# 4. 切到 "线路" Tab，等待 sources 加载完成
# 5. 截图 Drawer 区域（建议工具：macOS Cmd+Shift+4 框选 / 浏览器 DevTools "Capture full size screenshot"）
# 6. 保存到上述路径，命名严格 `video-edit-drawer-lines-tab.png`

# 7. 完成后告诉主循环 → 由主循环 commit + 转 -10-B 状态 ✅ + 推进 -10-C
```

**验收标准**：
- 文件存在 + 大小 > 10KB（不能是 placeholder）
- 文件名严格匹配 `video-edit-drawer-lines-tab.png`
- 内容含 Drawer 容器 + Lines Tab 激活态 + 至少 1 条 source 行

#### 完成判据

- ✅ 主循环已做：DEBT-SN-4-A 转登记 + 验收 + 文档同步
- ⏳ 待你做：截 1 张图 + 通知主循环
- ⏳ 主循环最终：git add + commit + 转 -10-B 状态 ✅
