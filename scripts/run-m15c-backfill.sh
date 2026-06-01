#!/usr/bin/env bash
#
# run-m15c-backfill.sh — META-15-C 全量富集 backfill 一键运行器
#
# 作用：编排既有 scripts/reenrich-backfill.ts（入队）+ 前置环境校验 +
#       基于 redis 队列深度的实时进度监控（worker 异步消费）。
#
# 设计原则：
#   - 只编排，不臆测：实际富集逻辑全在 reenrich-backfill.ts；本脚本负责
#     “跑之前确认环境对、跑之中能看到进度、跑完知道结束”。
#   - 失败即明确报错：任一前置不满足立即退出并给出修复命令，绝不静默继续。
#   - 队列名取自 SSOT 常量 enrichment-queue（apps/api/src/lib/queue.ts 的 new Bull('enrichment-queue')），
#     实现是 Bull v4（非 BullMQ），监控按 Bull v4 键结构读队列深度；可用 ENRICH_QUEUE_NAME 覆盖。
#
# ⚠️ 能力边界（必读）：本脚本**唯一可验证的交付物是“入队”**。监控段只能观测
#   **队列排空 = worker 出队消费了 job**，这 **不等于富集成功**——出队的 job 可能命中、
#   可能“无外部源匹配”（合法的非失败结果）、也可能重试耗尽后失败。队列深度无法区分三者。
#   因此 rc=0 含义是“已见证 worker 消费队列”，**不是**“富集都成功了”。
#   真实富集结果须另行核对：后台 ExternalMetaPanel / DB（media_catalog 等富集字段）/ api server 日志。
# 退出码契约（每个 exit 都精确对应其一，调用方可据此区分）：
#   0 = 已见证队列排空（仅进入监控且 worker 消费完时；富集结果未在此验证）；
#       或 -h/--help 打印用法后正常退出（约定俗成，不执行任何入队/监控）
#   2 = 仅完成入队/预览，未做排空监控（dry-run / --no-monitor / 0 入队 / 无 redis 跳过监控）
#       —— 不代表 worker 在消费，更不代表富集成功；需另行核对
#   3 = 进入了监控但未见证排空（连 worker 是否处理过本次 job 都无法确认；见警告排查）
#   1 = 前置/入队失败（die）/ 未知参数
#
# 前置（脚本会逐项检查）：
#   1. redis 在运行（富集队列后端）
#   2. apps/api dev server 在运行 —— 富集 worker 在 server.ts:194
#      registerEnrichmentWorker（concurrency=2），只有它在跑队列才会被消费。
#      ⚠️ 本脚本不替你启动 dev server（各环境命令不一），只检测 + 提示。
#   3. .env.local 存在（reenrich-backfill.ts 通过 --env-file 读取）
#
# 用法：
#   bash scripts/run-m15c-backfill.sh                 # 默认 mode=all，先 dry-run 预览再确认
#   bash scripts/run-m15c-backfill.sh --mode missing-characters
#   bash scripts/run-m15c-backfill.sh --mode anime-test   # 等价 --mode all --type anime --limit 20（冒烟验证）
#   bash scripts/run-m15c-backfill.sh --type anime --limit 20
#   bash scripts/run-m15c-backfill.sh --yes           # 跳过确认（CI / 无人值守）
#   bash scripts/run-m15c-backfill.sh --no-monitor    # 只入队，不进度监控
#   bash scripts/run-m15c-backfill.sh --dry-run       # 仅预览计数，不入队
#
set -euo pipefail

# ---- 0. 定位仓库根目录（脚本在 scripts/ 下） ----------------------------------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SELF="$SCRIPT_DIR/$(basename "${BASH_SOURCE[0]}")"   # 脚本自身绝对路径：--help 不能用相对 $0（下方 cd 后会失效）
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"

BACKFILL_TS="scripts/reenrich-backfill.ts"
ENV_FILE=".env.local"
POLL_INTERVAL=15           # 监控轮询间隔（秒）
NO_PROGRESS_LIMIT=8        # 连续 N 次无消费 → 判定 worker 未在跑

# ---- 颜色（无 tty 则降级为空串） --------------------------------------------
if [ -t 1 ]; then C_RED=$'\033[31m'; C_GRN=$'\033[32m'; C_YEL=$'\033[33m'; C_CYN=$'\033[36m'; C_RST=$'\033[0m'; else C_RED=; C_GRN=; C_YEL=; C_CYN=; C_RST=; fi
info()  { printf '%s[backfill]%s %s\n' "$C_CYN" "$C_RST" "$*"; }
ok()    { printf '%s[ ok ]%s %s\n'    "$C_GRN" "$C_RST" "$*"; }
warn()  { printf '%s[warn]%s %s\n'    "$C_YEL" "$C_RST" "$*"; }
die()   { printf '%s[fail]%s %s\n'    "$C_RED" "$C_RST" "$*" >&2; exit 1; }

# ---- 1. 解析参数 -------------------------------------------------------------
MODE="all"
TYPE=""
LIMIT=""
ASSUME_YES=0
DO_MONITOR=1
DRY_ONLY=0

while [ $# -gt 0 ]; do
  case "$1" in
    --mode)        MODE="${2:?--mode 需要值}"; shift 2;;
    --type)        TYPE="${2:?--type 需要值}"; shift 2;;
    --limit)       LIMIT="${2:?--limit 需要值}"; shift 2;;
    --yes|-y)      ASSUME_YES=1; shift;;
    --no-monitor)  DO_MONITOR=0; shift;;
    --dry-run)     DRY_ONLY=1; shift;;
    --poll)        POLL_INTERVAL="${2:?--poll 需要秒数}"; shift 2;;
    --anime-test)  MODE="all"; TYPE="anime"; LIMIT="20"; shift;;  # 等价显式三参，向后兼容别名
    -h|--help)
      sed -n '2,40p' "$SELF"; exit 0;;   # 仅打印用法 → 退 0（用绝对 $SELF，cd 后相对 $0 会失效；见头部退出码契约）
    *) die "未知参数：$1（用 --help 查看用法）";;
  esac
done

# 别名：--mode anime-test 也接受
if [ "$MODE" = "anime-test" ]; then MODE="all"; TYPE="anime"; LIMIT="20"; fi

case "$MODE" in
  never|unmatched|missing-characters|all) ;;
  *) die "非法 --mode：${MODE}（合法：never | unmatched | missing-characters | all）";;
esac

# ---- 2. 前置环境校验 ---------------------------------------------------------
info "仓库根目录：$REPO_ROOT"

command -v node >/dev/null 2>&1 || die "未找到 node。"
[ -f "package.json" ] || die "当前目录不是仓库根（缺 package.json）。"
[ -f "$BACKFILL_TS" ] || die "缺 $BACKFILL_TS —— META-15-C 入队脚本不存在，请确认分支。"
[ -f "$ENV_FILE" ]    || die "缺 $ENV_FILE —— reenrich-backfill.ts 依赖它读取 DATABASE_URL / REDIS / BANGUMI_API_TOKEN。"
ok "node / package.json / $BACKFILL_TS / $ENV_FILE 就绪"

# 解析 redis 连接：优先用 .env.local 的 REDIS_URL，否则默认本地 6379
REDIS_URL="$(grep -E '^REDIS_URL=' "$ENV_FILE" 2>/dev/null | head -1 | cut -d= -f2- | tr -d '"'"'"' ' || true)"
REDIS_CLI=(redis-cli)
if [ -n "$REDIS_URL" ]; then REDIS_CLI=(redis-cli -u "$REDIS_URL"); fi

if ! command -v redis-cli >/dev/null 2>&1; then
  warn "未找到 redis-cli —— 跳过 redis 连通性检查与进度监控（建议安装以获得完整体验）。"
  REDIS_OK=0
else
  if "${REDIS_CLI[@]}" ping >/dev/null 2>&1; then
    ok "redis 可达（${REDIS_URL:-localhost:6379}）"
    REDIS_OK=1
  else
    REDIS_OK=0
    cat <<EOF >&2
${C_RED}[fail]${C_RST} redis 无响应（${REDIS_URL:-localhost:6379}）。富集队列后端必须先起：
    redis-server                      # 直接前台启动
    brew services start redis         # macOS Homebrew 常驻
    docker run -d -p 6379:6379 redis  # 容器方式
起好后重跑本脚本。
EOF
    exit 1
  fi
fi

# ---- 3. 队列名 + worker（apps/api dev server）存活提示 ----------------------
# 富集 worker 内嵌在 apps/api 的 dev server（server.ts:194）。本脚本无法跨环境
# 可靠地替你启动它，只做检测 + 提示；真正判定靠第 6 步的“队列是否被消费”。
#
# 队列名是固定常量，不做“发现”：apps/api/src/lib/queue.ts 的 QUEUE_NAMES.ENRICHMENT。
# 实现是 **Bull v4**（`import Bull from 'bull'`，非 BullMQ）—— 键前缀默认 `bull`，
# 结构为 bull:<queue>:{wait,active,paused}(LIST) + {delayed,completed,failed}(ZSET)，
# **不存在 bull:<queue>:meta 键**（那是 BullMQ 特有），故不能靠 :meta 扫描发现队列。
# 可用环境变量 ENRICH_QUEUE_NAME 覆盖（默认与 SSOT 常量一致）。
QUEUE_NAME="${ENRICH_QUEUE_NAME:-enrichment-queue}"
if [ "$REDIS_OK" = "1" ]; then
  # 检测该队列在 redis 中是否已有任何键（producer 或 worker 触碰过即存在）。
  qkey="$("${REDIS_CLI[@]}" --scan --pattern "bull:$QUEUE_NAME:*" 2>/dev/null | head -1 || true)"
  if [ -n "$qkey" ]; then
    ok "目标队列：bull:$QUEUE_NAME:*（已存在于 redis）"
  else
    info "目标队列：bull:$QUEUE_NAME:*（redis 中暂无相关键，入队后将创建）"
    warn "若 worker 未启动，入队后不会被消费 —— 请在另一终端起 api dev server：npm run dev 或 npm run api"
  fi
fi

# ---- 4. dry-run 预览（永远先看清楚要处理多少条） ----------------------------
build_args() {
  local extra=("$@")
  printf '%s\n' --mode "$MODE"
  [ -n "$TYPE" ]  && printf '%s\n' --type "$TYPE"
  [ -n "$LIMIT" ] && printf '%s\n' --limit "$LIMIT"
  for e in "${extra[@]:-}"; do [ -n "$e" ] && printf '%s\n' "$e"; done
}

run_backfill() {  # 透传参数给 reenrich-backfill.ts
  local args=(); while IFS= read -r a; do args+=("$a"); done < <(build_args "$@")
  node --env-file="$ENV_FILE" --import tsx "$BACKFILL_TS" "${args[@]}"
}

info "运行 dry-run 预览（mode=$MODE${TYPE:+ type=$TYPE}${LIMIT:+ limit=$LIMIT}）…"
echo "------------------------------------------------------------"
run_backfill --dry-run || die "dry-run 失败 —— 检查 DATABASE_URL 是否可连、tsx 是否安装（npx tsx --version）。"
echo "------------------------------------------------------------"

if [ "$DRY_ONLY" = "1" ]; then
  ok "仅 dry-run 预览，未入队、未监控。去掉 --dry-run 再跑即可真正入队。"
  exit 2   # 仅预览：非「已见证排空」，按入队/预览-only 契约退 2
fi

# ---- 5. 确认后真正入队 ------------------------------------------------------
if [ "$ASSUME_YES" != "1" ]; then
  printf '%s即将入队 mode=%s%s%s。确认继续？[y/N] ' "$C_YEL" "$MODE" "${TYPE:+/type=$TYPE}" "$C_RST"
  read -r reply
  case "$reply" in y|Y|yes|YES) ;; *) die "已取消。";; esac
fi

# 监控辅助函数（Bull v4 键结构）。
# 数字净化：缺键返回 0；防 redis-cli 错误回复污染算术。
num() { case "$1" in ''|*[!0-9]*) echo 0 ;; *) echo "$1" ;; esac; }
llen()  { num "$("${REDIS_CLI[@]}" LLEN  "bull:$QUEUE_NAME:$1" 2>/dev/null)"; }
zcard() { num "$("${REDIS_CLI[@]}" ZCARD "bull:$QUEUE_NAME:$1" 2>/dev/null)"; }

info "入队中…（worker 将以 concurrency=2 异步消费）"
# 捕获 reenrich 输出以解析「实际入队数」——监控的成功判定锚定到它，
# 避免「队列空 == 成功」的误报（空也可能是 0 入队 / worker 没跑 / 队列名不符）。
enqueue_log="$(run_backfill)"; enqueue_rc=$?
printf '%s\n' "$enqueue_log"
[ "$enqueue_rc" -eq 0 ] || die "入队失败（reenrich-backfill.ts 退出码 ${enqueue_rc}）。"
# reenrich 末行：「已入队：N / M ✓」。进度用 \r 刷新 → 先 \r→\n 拆行，取最后一个 N。
ENQUEUED="$(printf '%s' "$enqueue_log" | tr '\r' '\n' | grep -oE '已入队：[0-9,]+' | tail -n1 | tr -dc '0-9')"
ENQUEUED="${ENQUEUED:-0}"
ok "入队完成（本次实际入队 ${ENQUEUED} 个 job）。"
if [ "$ENQUEUED" -eq 0 ]; then
  ok "无 job 入队（mode=$MODE 命中 0 条待富集视频）→ 无需监控。"
  exit 2   # 0 入队：未做排空监控，按入队/预览-only 契约退 2
fi

# ---- 6. 进度监控（基于 redis 队列深度，可 Ctrl-C 退出，不影响 worker 消费） --
if [ "$DO_MONITOR" != "1" ] || [ "$REDIS_OK" != "1" ]; then
  if [ "$REDIS_OK" != "1" ]; then
    warn "无 redis 连接，无法监控队列。已入队 ${ENQUEUED} 个 job，但本次未观测 worker 是否消费。"
  else
    info "已按 --no-monitor 跳过监控。已入队 ${ENQUEUED} 个 job；如需观察可去掉 --no-monitor 重跑，或周期性 'redis-cli LLEN bull:${QUEUE_NAME}:wait' 看剩余数下降。"
  fi
  exit 2   # 入队完成但未做排空监控，按入队/预览-only 契约退 2
fi

# num/llen/zcard 已在入队前（第 5 步）定义。Bull v4 键类型：
# wait/active/paused = LIST（LLEN）；delayed/completed/failed = ZSET（ZCARD）。
#
# 判据（Codex 多轮收敛后的结论）：监控能可靠判定的**只有“worker 是否在消费队列”**，
# **不是“富集是否成功”**（见文件头能力边界）。唯一可信的“worker 在消费”证据是
# **亲眼见证 pending>0 降到 0**（observed_work）。completed/failed 计数连这点都不可用作判据——
#   ① enrichment-queue 是共享队列（crawler CrawlerService:300 + 既往 backfill），陈旧痕迹使「>0」误报；
#   ② removeOnComplete:200 使 completed **封顶在 200**，稳态下入队前已达上限、消费后仍是 200，
#      故「较基线增长」在正常封顶队列上也为假。
# 因此 completed/failed 仅作展示，不参与判定。首轮轮询在入队后立即执行（sleep 在循环末），
# 真实网络型富集 job（douban/bangumi 调用，秒级）不可能在毫秒内被清空 → 活 worker 必被 pending>0 捕获。
prev_pending=-1
stale=0
observed_work=0   # 是否曾见证 pending>0；唯一可信的“worker 在消费”证据（非富集成功证据，见上）
while true; do
  waiting=$(llen wait); active=$(llen active); paused=$(llen paused); delayed=$(zcard delayed)
  completed=$(zcard completed); failed=$(zcard failed)
  pending=$(( waiting + active + delayed + paused ))
  pausednote=""; [ "$paused" -gt 0 ] && pausednote=" 暂停=$paused(队列已 pause!)"
  printf '%s[%s]%s 待处理=%s 进行中=%s 延迟=%s%s | 完成(近期保留)=%s 失败=%s\n' \
    "$C_CYN" "$(date +%H:%M:%S)" "$C_RST" "$waiting" "$active" "$delayed" "$pausednote" "$completed" "$failed"

  if [ "$pending" -eq 0 ]; then
    if [ "$observed_work" -eq 1 ]; then
      # 见证了 pending>0 → 0：只有活着的 worker 能把 pending 清零 → 确认 worker 在消费、队列已空。
      # ⚠️ 排空≠富集成功：出队的 job 可能命中 / 无匹配（合法非失败）/ 重试耗尽失败，队列深度无法区分。
      ok "队列已排空：worker 已消费完待处理 job（出队 ≠ 富集成功）。"
      info "富集**结果**请另行核对：后台 ExternalMetaPanel / DB（media_catalog 富集字段）/ api server enrichment-queue 日志。"
      MONITOR_RC=0
    else
      # 首轮即空、从未见证 pending>0 → 无法证实本次 job 被处理（Codex：避免误报）→ 退出码非 0。
      warn "首轮轮询即为空，从未见证待处理 job —— 无法确认本次 ${ENQUEUED} 个 job 是否被真正处理。"
      warn "可能：worker（server.ts:194）未运行 / 队列名不符（ENRICH_QUEUE_NAME）/ 入队后在首轮轮询前被极快清空（真实网络型 job 不应如此）。"
      warn "请到 api server 日志核对 enrichment-queue 处理记录，确认 worker 在运行后再判定/重跑。"
      MONITOR_RC=3
    fi
    # failed 为队列总数（含既有，非必为本次）；仅作提示，不参与判定。
    [ "$failed" -gt 0 ] && warn "队列 failed 计数=${failed}（含既有失败，非必为本次）。如需排查：redis-cli ZRANGE bull:${QUEUE_NAME}:failed 0 -1。"
    break
  fi
  observed_work=1   # 能走到这说明 pending>0，记下“确实见证过待处理工作”

  # 无消费判定：pending 连续多轮不下降且无 active → worker 大概率没在跑（removeOnComplete 下 completed 不可靠）
  if [ "$pending" -ge "$prev_pending" ] && [ "$prev_pending" -ge 0 ] && [ "$active" -eq 0 ]; then
    stale=$((stale + 1))
    if [ "$stale" -ge "$NO_PROGRESS_LIMIT" ]; then
      warn "连续 ${NO_PROGRESS_LIMIT} 轮 pending 未下降且无进行中任务（仍剩 ${pending}）—— worker 可能未运行。"
      warn "请确认 apps/api dev server 在跑（worker 在 server.ts:194；起：npm run dev 或 npm run api）。监控继续，Ctrl-C 退出。"
      stale=0
    fi
  else
    stale=0
  fi
  prev_pending="$pending"
  sleep "$POLL_INTERVAL"
done

# 监控段退出码（见文件头能力边界）：0=已见证队列排空（worker 在消费，富集结果未在此验证）/
# 3=未见证排空（连 worker 是否处理本次 job 都无法确认）。供自动化调用方区分；二者均不代表富集成功。
exit "${MONITOR_RC:-0}"
