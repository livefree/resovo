# Resovo 前端交付包 · Claude Code Handoff

> 交付给开发的完整设计资产 + 集成说明。所有 HTML 为**可运行的高保真 mock**，打开即可在浏览器查看。

---

## 📦 包含内容

```
HANDOFF/
├── HANDOFF.md                      ← 本文档（先读这个）
├── Integration Plan.md             ← 4 个 PR 的落地拆分 + 估时
├── Token Audit.md                  ← 现有 tokens 审计 + 30 个需新增的变量清单
│
├── designs/                        ← 高保真可运行设计稿（HTML）
│   ├── home-b.html                 ← 首页
│   ├── Site Design.html            ← 全站（列表/详情/播放/搜索/筛选/个人中心）
│   ├── Global Shell.html           ← 页眉 / 页脚 / MiniPlayer / 背景图案 / 设置抽屉
│   └── Motion Spec.html            ← 14 种动效规范的可运行 demo
│
├── design-canvas.jsx               ← 多稿画布（用于并排查看各版本）
│
└── packages/design-tokens/         ← 现有 tokens（原样，未改动）
    ├── README.md
    └── src/
        ├── brands/default.ts
        ├── primitives/             (color / motion / radius / shadow / size / space / typography / z-index)
        ├── semantic/               (accent / bg / border / fg / surface / state / stack / tag / tabbar / skeleton / takeover / route-stack / shared-element)
        ├── components/             (button / card / player)
        └── css/tokens.css
```

---

## 🚀 开发切入顺序（推荐）

| 阶段 | 目标 | 关键文件 |
|---|---|---|
| **1. Token 补齐** | 把 `Token Audit.md` 第 2 节 30 个新 token 加进 `packages/design-tokens/src/` 对应模块 | `Token Audit.md` · `packages/design-tokens/` |
| **2. 修复西里尔字母** | `Token Audit.md` 第 4 节：`lifecycleDеlisting*` → `lifecycleDelisting*`（e 是 U+0435） | 全局 grep + 替换 |
| **3. 全局外壳** | 落地 Header/Footer/MiniPlayer/Settings Drawer/背景图案/三态主题 | `designs/Global Shell.html` |
| **4. 动效层** | 把 Motion Spec 中的 14 种动效沉淀为 `packages/motion` | `designs/Motion Spec.html` |
| **5. 页面** | 按 `Integration Plan.md` 的 4 个 PR 逐一实现 | `designs/home-b.html` · `designs/Site Design.html` |

---

## ⚠️ 实现要点（设计意图，勿改）

### 主题系统
- **三态**：`system` / `light` / `dark`，默认 `system`
- 监听 `matchMedia('(prefers-color-scheme: dark)')`，**仅在 `system` 模式**下响应 OS 切换
- 持久化 key：`resovo.shell.prefs.v1`

### MiniPlayer
- 离开 `/watch` 时自动进入（由 `state.autoMini` 控制）
- 尺寸：240 / 320 / 480 三档，右下角可拖拽缩放（保持 16:9）
- 拖拽：释放时吸附到最近的四角（16px 边距）
- 返回播放页：点击视频区域 OR hover 出现的 chip，均触发 `router.push('/watch/current')`
- 关闭：✕ 按钮（右上角，hover 可见）

### 动效强度
- CSS 变量 `--motion-scale`（0~1.5），默认 1
- 所有动画时长乘以该变量：`animation-duration: calc(var(--raw-anim) * var(--motion-scale))`
- "减弱动效" 开关：强制 scale=0.25（而不是 `prefers-reduced-motion: reduce`，后者在某些浏览器下为 0）

### 筛选页
- 再次点击已选的 chip = 取消选择；**没有独立的"已选"区域**
- chip 的选中态用 `var(--accent-muted)` 背景 + `var(--accent-default)` 文字

### 卡片标题
- 有缩略图时 `showTitle={false}`（标题不叠在图上）
- 仅在列表视图 / 无图态 / WatchPlayerFrame（独立顶栏）中渲染文字标题

---

## 🎨 Tokens 快速参考

打开 `packages/design-tokens/src/css/tokens.css` 看完整变量。常用：

| 用途 | Token |
|---|---|
| 主背景 | `--bg-canvas` |
| 卡片/面板 | `--bg-surface` / `--bg-surface-raised` |
| 主文字 | `--fg-default` |
| 次要文字 | `--fg-muted` / `--fg-subtle` |
| 边框 | `--border-default` / `--border-subtle` |
| 强调色 | `--accent-default` / `--accent-muted` / `--accent-fg` |

---

## 🔗 联系

设计稿若有疑问，查 `Integration Plan.md` 的"风险"章节或直接反馈。
所有 HTML 都是可运行的 mock，可以直接在开发机打开对照。
