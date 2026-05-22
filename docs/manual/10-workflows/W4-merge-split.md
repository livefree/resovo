# W4 · 合并候选 → 确认 / 拒绝 / 回滚

> status: 🟡 骨架
> 触发场景：审核中发现疑似重复视频 / 或定期清理合并候选

## 0. 元信息
- 涉及页面：[P-merge](../20-pages/P-merge.md) / [P-moderation](../20-pages/P-moderation.md)
- 适用角色：moderator+
- 关联设计：reference.md §5.9

## 1. 入口（多入口设计）
- 主入口：侧栏 → 合并拆分
- 从审核台进入：右栏「类似」Tab → 「发起合并」按钮 → 带 candidate_a 深链（CHG-SN-8-04 待启动）
- ✅ 从视频库进入（CHG-SN-8-08 已实施）：视频库某行「⋯」dropdown → 「发起合并」→ 跳 `/admin/merge?candidate_a=<id>&from=videos` → Merge 页顶部 banner「已锁定候选 A: <短 ID>」+「清除」按钮

## 2. 端到端步骤

### 2.1 系统候选路径（待审候选 segment）
```
①  待审候选 segment → 看置信度 pill 排序
②  card 形态：左右视频卡对比 + 中间合并原因 + 底部影响预览
③  「确认合并」→ 二次确认（哪个为主体）→ 执行
④  影响预览：线路 / 源 / 收藏 / 可回滚
```

### 2.2 视频库行级 → Merge 页直接合并（CHG-SN-8-08 + 08-B 已实施）
```
①  视频库选某行 → 「⋯」→ 「发起合并」
②  跳 /admin/merge?candidate_a=<id>&from=videos
③  顶部 banner 显示「已锁定候选 A: V001」+「清除」
④  banner 下方「直接合并工作区」AdminCard：
    └─ VideoPicker 选候选 B（搜索式 + 触发器回显标题+shortId）
    └─ 「立即合并」按钮（B 未选 / B === A 时 disabled）
⑤  点「立即合并」→ confirm「以 A 为主体保留；B 将合并到 A 后软删除」
⑥  调 mergeVideos({ sourceVideoIds: [B.id], targetVideoId: A.id })
⑦  toast「合并成功 · auditId=xxxx · 已合并到 A」+ banner 自动清除
⑧  撤销路径：审计日志找 auditId → unmerge
```

