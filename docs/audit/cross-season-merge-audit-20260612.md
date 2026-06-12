# 跨季误合并存量盘点报告（VIDEO-NAMING-STANDARD-C / SEQ-20260612-01）

> status: active
> owner: @engineering
> scope: 旧三元组匹配期跨季混挂 + 季槽位错位 + 发布形态撞键 三类存量问题盘点
> source_of_truth: yes（盘点结论真源；修复执行情况见各后续卡 changelog）
> supersedes: none
> superseded_by: none
> last_reviewed: 2026-06-12

审计脚本：`scripts/audit-cross-season-merge.ts`（只读，TS 调 `parseTitle` 1.2.0 精确口径，含中文数字/括号季标）。
审计时点：2026-06-12，dev 库（videos 4405 / media_catalog 4396 / video_sources 564,162 / watch_history 0）。

---

## A 类：跨季混挂（6 例，需逐个人工核对）

同一 video 的标题+别名解析出 ≥2 个不同季号——旧三元组匹配期「同名不同季」复用同一实体，sources 可能跨季混挂。

| video_id | 当前标题 | 检出季号 | sources（行/集）| episode_count |
|---|---|---|---|---|
| 43f37d42… | 掌心饵，驯娇记 第1季 | {1,2} | 4/1 | 1 |
| 6fe0f498… | 恶搞之家 第23季 | {23,24} | 20/10 | 15 |
| aa7f96de… | 动物管制官 第四季 | {3,4} | 132/12 | 12 |
| b564ec4f… | 宠妻成瘾：陆少的心尖宠动态漫画 第2季 | {1,2} | 40/20 | 20 |
| cc2c9843… | 动物管制官 第4季 | {3,4} | 10/10 | 10 |
| e273b1ce… | 偶滴歌神啊 第1季 | {1,2} | 30/12 | 12 |

判读要点：

- 部分案例可能是**别名噪声**（采集源把相邻季塞进备注/别名）而非真混挂——需逐例比对 sources 的 URL/集数段归属后再定拆分。
- `动物管制官` 出现 **两个视频**（第四季/第4季，季号均={3,4}）——同季中文/阿拉伯写法裂成两实体 + 各自混挂第 3 季别名，是「旧归并键 + 旧季处理」双重历史问题的典型样本，拆分时应一并合并去重。
- 拆分手术涉及：新建正确季 catalog/video、sources 按集数段重挂、ES 重同步、（生产）watch_history 迁移。dev 库 watch_history 为 0，**进度迁移影响面为零**；生产执行前必须重跑本审计。

## B 类：季槽位错位（355 例，可直接安全回填 → 已具备执行条件）

video 标题/别名解析出**唯一**季号 N，但 `media_catalog.season_number IS NULL`。

**为什么这是活跃风险而不只是历史遗留**：VIDEO-NAMING-STANDARD-A 之后采集走四元组匹配
`(title_normalized, year, type, season_number)`，`season_number IS NOT DISTINCT FROM N`
对 NULL 槽位**永不命中** → 这 355 个视频每次被重爬都会**新建重复 catalog/video**。
B 卡（存量标题清洗）当时刻意不回填 season_number 规避唯一键风险——本次盘点已做撞键预检消除该顾虑。

- 季号分布：第 1 季 ×55 / 第 2 季 ×129 / 第 3 季 ×48 / 第 4 季 ×35 / 第 5 季 ×20 / 其余长尾至第 42 季。
- **回填撞键预检：0 例冲突**——对每例查 `(title_normalized, type, year, N)` 四元组既有占位，全部为空，可直接 `UPDATE ... SET season_number = N WHERE season_number IS NULL`。
- 修复方案：脚本化回填（dry-run/幂等/复用本审计的解析口径），不动 title_normalized / 不动 videos 行 / 无 ES 影响（season_number 不在搜索索引）。→ **VIDEO-NAMING-STANDARD-D 卡**。

## C 类：发布形态 normalized 撞键（1 例）

| video | 标题 | 问题 |
|---|---|---|
| 5fda8802… | 魔法使俱乐部(OVA) | `title_normalized=魔法使俱乐部`，与正篇 catalog「魔法使俱乐部」**同 key 并存**；正篇/OVA 重爬时 Step 5 `LIMIT 1` 可能互相误绑 |

旧 `normalizeMergeKey` 整体剥括号产物（新路径 1.2.0 起 identityTitle 保留 marker，normalized=`魔法使俱乐部 ova` 不再撞）。修复：单行 UPDATE 该 catalog 的 title_normalized 为含 marker 口径 + 显示标题标准化为「魔法使俱乐部 OVA」——并入 A 类人工核对卡一次处理。

## 处置建议（拆卡）

1. **VIDEO-NAMING-STANDARD-D（建议立即执行，低风险高收益）**：B 类 355 例 season_number 回填脚本。撞键预检 0；防新爬重复实体的止血修复。
2. **VIDEO-NAMING-STANDARD-E（候补，人工逐例）**：A 类 6 例拆分核对 + C 类 1 例 normalized 修正 + 「动物管制官」双实体合并。实体手术，建议人工确认 sources 归属后执行；生产执行前重跑审计（watch_history 影响面）。

---

## GOV-6 逐例取证（2026-06-12 第二轮，手术执行待用户逐例批准）

| # | 实体 | 证据 | 置信度 | 建议处置 |
|---|---|---|---|---|
| 1 | 掌心饵，驯娇记 第1季（43f37d42） | dbzy.tv **站点观测=第二季**（直接归属证据）；mtzy.me 无观测推定 S1；各 2 行 ep1 | 高 | **拆分**：dbzy.tv 2 行 → 新建 S2 实体；本体定 S1 |
| 2 | 宠妻成瘾动态漫画 第2季（b564ec4f） | 单站 ffzyapi 先后爬 S1/S2（双观测）；全量替换已软删 S1 批 38 行（ep1-19），存活 40 行=S2（ep1-20） | 高 | **不拆**：仅 catalog season=2 落位；S1 待重爬自然建独立实体（软删行多为失效 URL 不复活） |
| 3 | 偶滴歌神啊 第1季（e273b1ce） | 单站 ffzyapi 15 行/12 集（3 集双行=两季 URL 并存），无站点观测区分 | 中 | **暂缓**：需 URL 级人工抽查归属；或等重爬观测 |
| 4 | 恶搞之家 第23季（6fe0f498） | 双站各 10 集，无站点观测；S23/S24 归属无证据 | 低 | **暂缓**：GOV-4 后重爬即产生站点观测，证据累积后再拆 |
| 5 | 动物管制官 ×2（aa7f96de 8 站 12 集 / cc2c9843 1 站 10 集） | 两实体各自混挂 S3+S4 别名，均无站点观测 | 低 | **暂缓**：同上等观测；暂不互并（合并会扩大混挂面） |
| 6 | 星辰变 catalog（c8f89de3，题「第六季」） | 下挂 **S5 视频（28 集）+ S7 视频（12 集）**，catalog 题名季号与内容均错位 | 高 | **catalog 重排**：S5/S7 各建独立季 catalog 并迁移 video，纠正题名；无视频拆分 |
| 7 | 师兄啊师兄 catalog（dd85fa38） | 正篇（143 集，无季标=连续话数）+ 第2季（144 集）同 catalog | 高 | **catalog 重排**：第2季 video → 独立 (师兄啊师兄, S2) catalog；正篇留 NULL 槽位 |
| 8 | 魔法使俱乐部(OVA)（5fda8802） | normalized=魔法使俱乐部 与正篇 catalog 同 key 并存（旧路径产物） | 高 | **单行修正**：normalized 改「魔法使俱乐部 ova」+ 显示标题「魔法使俱乐部 OVA」 |

暂缓项（3/4/5）共同出路：GOV-4 已使每次重爬写站点级观测，证据自然累积；每日 reconcile 重扫保持候选可见。
