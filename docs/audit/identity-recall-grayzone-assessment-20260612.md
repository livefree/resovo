# 候选阈值灰区 + 召回缺口评估（GOV-7 / SEQ-20260612-03）

> status: active
> owner: @engineering
> scope: identity 候选 0.75 阈值灰区分布 + titleEn/简繁召回缺口量化与实施建议
> source_of_truth: yes（评估结论真源；实施情况见后续卡 changelog）
> supersedes: none
> superseded_by: none
> last_reviewed: 2026-06-12

评估脚本：`scripts/identity-grayzone-report.ts`（**纯只读**：镜像 offlineRescore blocking 遍历逐 pair scorePair 不持久化）。
评估时点：2026-06-12，dev 库（parser 1.2.0 / scorer 1.0.0 / CANDIDATE_MIN_THRESHOLD=0.75）。

## 1. 分布事实

blocking 可达 pair 全集 1061 对：候选区 ≥0.75 = **96** / 灰区 [0.55,0.75) = **99**（其中 [0.55,0.60) 占 94）/ [0.50,0.55) = **581（噪声海）** / 强负拦截 190。

## 2. 关键发现

**F1（灰区主体是真重复，但阈值不能粗暴下调）**：灰区 top 20 几乎全部为高置信同作对——同名纯标点差异（「保安有梦：」↔「保安有梦:」）、感叹号差异（「丰臣兄弟！」↔「丰臣兄弟」）、后缀变体（「名侦探柯南（中配）」↔「名侦探柯南」）、**完全同名**（「全知干预视角」↔ 同名，因 year 缺失/不一致拿不到年份证据，纯 coreTitleKey 命中恒 0.60）。但 0.75→0.55 直降会放进 [0.50,0.55) 的 581 对噪声——**正确路径是窄切片而非降阈值**：「同 coreTitleKey + 无强负 + year 缺失或 ±1」的结构化子集单独准入（或入低优先候选态）。

**F2（强负拦截工作正常）**：「危险关系[电影解说]」↔ 正片被 year_far_no_exact 拦截、跨季对被 season_mismatch 拦截——均为正确行为，无需调整。

**F3（titleEn 第三 blocking 键收益小而确定）**：共享 title_en 但 title_normalized 不同的组仅 **17 组**，且多为拼音 title_en 偶合的同作变体（「鸣鹤 5：幽兰录」↔「鸣鹤5：幽兰录」空格差 /「木乃伊2026」↔「木乃伊（2026）」年份粘连）——这些对 coreTitleKey 桶**不互见**（空格/数字粘连导致 key 不同），title_en 等值桶可低成本召回（blockingRecall 加第三段 UNION，与段 ② 同构）。

**F4（简繁折叠暂不立案）**：top 清单未出现简繁对；折叠需 OpenCC = 技术栈外依赖（CLAUDE.md BLOCKER 级），数据不支持引入成本。

## 3. 实施建议（候选卡，待用户决定是否启动）

1. **GRAY-SLICE 卡（中收益 / 需谨慎）**：灰区窄切片准入策略——评分管线/阈值体系（D-105a weights）变更，**强制 arch-reviewer (Opus) 裁决**切片谓词与防噪声护栏；预期收益 ≈ 灰区 99 对中的高置信子集（人工抽样 top 20 全为真重复）。
2. **TITLEEN-BUCKET 卡（小收益 / 低风险）**：blockingRecall 第三 blocking 键（title_en 等值桶，17 组缺口）；纯加性召回，评分语义零变更，常规小卡。
3. **简繁折叠：不立案**（F4）。
