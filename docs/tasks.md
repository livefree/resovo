# Resovo（流光） — 任务看板

> last_reviewed: 2026-05-26

---

## 进行中任务

（空）

---

## 下次会话恢复入口

HOTFIX-A + B + C 全部代码已落地（commits `d79769cc` + `0a0cc4e8` + 待提交），状态 🟡 等 @livefree dev server 实测：

- HOTFIX-A 6 路径（changelog `CHG-SN-9-CW1-CW2-HOTFIX-A` §验收）— 1/2/3/5/6 已 ✅，4（时间轴拖拽 / 历史回看）改入 D-155-3
- HOTFIX-B 2 路径（changelog `CHG-SN-9-CW1-CW2-HOTFIX-B` §验收）— 待实测 7（孤儿 run 取消转态）+ 8（interval 显示）
- HOTFIX-C 3 路径（changelog `CHG-SN-9-CW1-CW2-HOTFIX-C` §验收）— 待实测：
  1. 暂不改 .env.local 重启 api → 红色警告卡 + PageHeader 🚨
  2. 加 CRAWLER_SCHEDULER_ENABLED=true 重启 → 警告消失，countdown 恢复
  3. 下一个匹配 dailyTime 整分钟 → 触发 daily run（出现在 /admin/crawler/runs）

实测全 PASS → task-queue 三张卡状态 🟡→✅ → 启 REDESIGN-A-ADR（opus 主循环 + arch-reviewer Opus，起草 ADR-155 覆盖 D-155-1..6，含多 dailyTime）。
实测发现新问题 → 起 HOTFIX-D 或对应 EP。

（详见 task-queue.md SEQ-20260526-CRAWLER-W3-FIX）
