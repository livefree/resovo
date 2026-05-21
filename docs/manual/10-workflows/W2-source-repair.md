# W2 · 线路失效 → 补源 → 复测

> status: 🟡 骨架（M-SN-8 落地）
> 触发场景：审核台 / 视频库发现"探测/播放 全失效"，要把视频救回来

## 0. 元信息
- 涉及页面：[P-sources](../20-pages/P-sources.md) / [P-moderation](../20-pages/P-moderation.md) / [P-videos](../20-pages/P-videos.md)
- 适用角色：editor+
- 关联设计：reference.md §5.4

## 1. 端到端步骤（待 CHG-SN-8 系列填充）
```
①  /admin/sources?filter=dead → 找到目标视频
②  展开行 → 线路矩阵看哪几集失效
③  使用「线路别名」+「一键替换最相似 URL」修复
④  「重验全部」→ 等待探测完成
⑤  状态回绿 → 视频可正常播放
```

## 2. 反例
- 「一键替换最相似 URL」按钮无 onClick → 死按钮（CHG-SN-8-XX 修复）
- 线路别名（displayName）有后端但矩阵列不显示 → 信息断（CHG-SN-8-XX 修复）

