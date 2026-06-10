-- 102_task_runs.sql
-- ADR-194：task_runs 统一抽象层（path B）+ 真源关系裁定「只读投影」
-- NTLG-P2-a-A / SEQ-20260609-01
--
-- task_runs = 当前无持久 run 表的 bull 作业统一登记层（enrichment/imageHealth/maintenance/未来自动化）。
--   crawler **不写本表**（crawler_runs 保持采集批次唯一真源，D-194-1）；统一视图由 TaskAggregator
--   在读时对 crawler_runs ∪ task_runs 做只读 union 投影（D-194-2，最强反漂移、零同步路径）。
--   id BIGSERIAL（id::text 序列化对齐 TaskRunId=string，ADR-193 D-193-3）；
--   kind 无 CHECK（类型层校验，保未来自动化作业类型扩展，D-194-DEV-3，同 notifications.scope 哲学）；
--   status 6 态 DB CHECK（统一状态机 §4.2 + cancelling 协作式取消中间态 D-194-6）；progress SMALLINT 0-100（NULL=indeterminate）；
--   digest JSONB 承载 TaskResultDigest（ADR-193，finish 落库）。
-- 本卡纯加性空跑兼容：Reporter 有真实写但暂无 worker 调用方（接入归 -B）、TaskAggregator 暂不读（归 -B）。
--
-- ⚠️  Down 路径说明（项目约定）：scripts/migrate.ts 整文件单条执行，不区分 up/down；
--     down 保持注释，回滚时手动解注释独立执行（与 094–101 同约定）。

-- ── up ───────────────────────────────────────────────────────────────────────

BEGIN;

CREATE TABLE IF NOT EXISTS task_runs (
  id           BIGSERIAL     PRIMARY KEY,
  -- 作业类型语义键（'enrichment' | 'image_health' | 'maintenance' | <future>；无 CHECK，类型层校验 D-194-DEV-3）
  kind         TEXT          NOT NULL,
  -- 人读标题（→ AdminTaskItem.title）
  title        TEXT          NOT NULL,
  -- 关联实体 / 外部 id（bull jobId 等，反查）
  ref          TEXT,
  -- 统一状态机 6 态 DB CHECK：pending / running / cancelling / success / failed / cancelled。
  --   cancelling = 协作式取消中间态（running→cancelling→cancelled，D-194-6 / P2-a-C 控制路径写入；
  --     bull 无原生协作取消，worker 轮询本 status 信号实现，替代 ADR-191 P0 的 409）；是 §4.2 直接
  --     cancel→cancelled 的精化（crawler 走 crawler_runs.control_status='cancelling'，task_runs 统一走 status 信号）。
  --   cancelled 保真终态，投影时映射 AdminTaskItem.status='failed'（同 crawler STATUS_MAP）。
  status       TEXT          NOT NULL DEFAULT 'pending'
                             CHECK (status IN ('pending', 'running', 'cancelling', 'success', 'failed', 'cancelled')),
  -- determinate 进度 0-100；NULL=indeterminate
  progress     SMALLINT      CHECK (progress IS NULL OR progress BETWEEN 0 AND 100),
  -- TaskResultDigest（ADR-193，finish 落库；已 strip comments 由消费方保证，同 notifications.payload）
  digest       JSONB,
  -- 失败信息（→ AdminTaskItem.errorMessage）
  error        TEXT,
  started_at   TIMESTAMPTZ,
  finished_at  TIMESTAMPTZ,
  created_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- 索引设计 4 步核验（db-rules §索引设计）：
-- ① 索引键：(created_at DESC) — 支撑 task_runs 列表「按时间倒序分页 / 终态窗口扫描」（listTaskRuns 默认排序）。
-- ② 全表索引（无 WHERE）：覆盖全部行，无反向条件 invariant。
-- ③ driving 谓词：ORDER BY created_at DESC + LIMIT（listTaskRuns 主查询，无 status 过滤分支）；非等值过滤，DESC 方向匹配。
-- ④ 与 idx_task_runs_status(status,created_at) 区隔：本索引服务「全 status 混合时间线」（无 status 过滤的全量列表 / 维护扫描）；带 status 过滤走复合索引。
CREATE INDEX IF NOT EXISTS idx_task_runs_created_at
  ON task_runs (created_at DESC);

-- 索引设计 4 步核验：
-- ① 索引键：(status, created_at) — 复合，前缀 status 等值 + created_at 排序。
-- ② 全表索引（无 WHERE）：覆盖全部行，无反向条件 invariant。
-- ③ driving 谓词：任务闪电 running 计数 `COUNT(*) WHERE status='running'`（§4.1）+ 终态列表 `WHERE status = ANY(...) ORDER BY created_at DESC`；status 等值定位 + created_at 排序裁剪，复合键完全支撑。
-- ④ 与 idx_task_runs_created_at 区隔：带 status 过滤/计数走本复合索引（status 首列定位）；无 status 过滤的纯时间线走 ①。
CREATE INDEX IF NOT EXISTS idx_task_runs_status
  ON task_runs (status, created_at DESC);

COMMENT ON TABLE task_runs
  IS '后台作业统一登记层（ADR-194 path B / D-194-1/2「只读投影」）；仅登记当前无持久 run 表的 bull 作业（enrichment/imageHealth/maintenance/...），crawler 不写本表（crawler_runs 仍唯一真源，读时 union 投影）；id::text 对齐 TaskRunId / kind 类型层校验 / status 5 态 CHECK / digest 承载 TaskResultDigest（ADR-193）';

COMMIT;

-- ── down ─────────────────────────────────────────────────────────────────────

-- BEGIN;
-- DROP TABLE IF EXISTS task_runs;
-- COMMIT;
