<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  getTraceThread,
  getRecentThreads,
  type TraceThread,
  type TraceRecentThreadItem,
} from '@/api/trace'

// ============================================================
// 状态
// ============================================================
const route = useRoute()
const router = useRouter()

const recentThreads = ref<TraceRecentThreadItem[]>([])
const selectedThreadId = ref<string | null>(null)
const detail = ref<TraceThread | null>(null)

const listLoading = ref(false)
const detailLoading = ref(false)
const listError = ref<string | null>(null)
const detailError = ref<string | null>(null)

const searchInput = ref('')

// ============================================================
// 加载列表
// ============================================================
async function loadRecentThreads() {
  listLoading.value = true
  listError.value = null
  try {
    recentThreads.value = await getRecentThreads(20)
  } catch (err: any) {
    listError.value = err?.message ?? '加载失败'
    recentThreads.value = []
  } finally {
    listLoading.value = false
  }
}

// ============================================================
// 加载详情
// ============================================================
async function loadDetail(threadId: string) {
  if (!threadId) return
  selectedThreadId.value = threadId
  detailLoading.value = true
  detailError.value = null
  try {
    detail.value = await getTraceThread(threadId)
    if (!detail.value) {
      detailError.value = '未找到该 thread'
    }
  } catch (err: any) {
    detailError.value = err?.message ?? '加载失败'
    detail.value = null
  } finally {
    detailLoading.value = false
  }
}

function onSelectThread(threadId: string) {
  router.replace({ query: { threadId } })
}

function onSearch() {
  const id = searchInput.value.trim()
  if (!id) return
  router.replace({ query: { threadId: id } })
}

watch(
  () => route.query.threadId,
  (id) => {
    if (typeof id === 'string' && id) {
      loadDetail(id)
    }
  },
  { immediate: true },
)

loadRecentThreads()

// ============================================================
// 时间线合并
// ============================================================
type TimelineEvent =
  | { kind: 'message'; at: string; data: any }
  | { kind: 'judgement'; at: string; data: any }
  | { kind: 'llm'; at: string; data: any }

const timeline = computed<TimelineEvent[]>(() => {
  if (!detail.value) return []
  const events: TimelineEvent[] = [
    ...detail.value.messages.map((m) => ({
      kind: 'message' as const,
      at: m.createdAt,
      data: m,
    })),
    ...detail.value.judgements.map((j) => ({
      kind: 'judgement' as const,
      at: j.createdAt,
      data: j,
    })),
    ...detail.value.llmCalls.map((l) => ({
      kind: 'llm' as const,
      at: l.createdAt,
      data: l,
    })),
  ]
  return events.sort(
    (a, b) => new Date(a.at).getTime() - new Date(b.at).getTime(),
  )
})

// ============================================================
// 状态判断
// ============================================================
const isLegacyThread = computed(() => {
  if (!detail.value) return false
  const t = detail.value.thread
  if (!t.finishedAt) return false
  if (detail.value.llmCalls.length > 0) return false
  if (detail.value.judgements.length > 0) return true
  return false
})

const isAbnormalThread = computed(() => {
  if (!detail.value) return false
  const t = detail.value.thread
  if (!t.finishedAt) return false
  if (detail.value.judgements.length > 0) return false
  if (detail.value.llmCalls.length > 0) return false
  const hasUserMessage = detail.value.messages.some(
    (m: any) => m.role === 'user',
  )
  return hasUserMessage
})

// ★ LLM 消耗汇总（当前 thread 所有 LLM 调用）
const totalPromptTokens = computed(() => {
  if (!detail.value) return 0
  return detail.value.llmCalls.reduce(
    (sum, l) => sum + (l.promptTokens ?? 0),
    0,
  )
})

const totalCompletionTokens = computed(() => {
  if (!detail.value) return 0
  return detail.value.llmCalls.reduce(
    (sum, l) => sum + (l.completionTokens ?? 0),
    0,
  )
})

const totalCacheHitTokens = computed(() => {
  if (!detail.value) return 0
  return detail.value.llmCalls.reduce(
    (sum, l) => sum + (l.promptCacheHitTokens ?? 0),
    0,
  )
})

const totalCacheMissTokens = computed(() => {
  if (!detail.value) return 0
  return detail.value.llmCalls.reduce(
    (sum, l) => sum + (l.promptCacheMissTokens ?? 0),
    0,
  )
})

const cacheHitRate = computed<number | null>(() => {
  const total = totalCacheHitTokens.value + totalCacheMissTokens.value
  if (total === 0) return null
  return totalCacheHitTokens.value / total
})

const totalDurationMs = computed(() => {
  if (!detail.value) return 0
  return detail.value.llmCalls.reduce(
    (sum, l) => sum + (l.durationMs ?? 0),
    0,
  )
})

// ★ 是否有任何 token 数据（有的老 thread 有 llmCalls 但 token 全 null）
const hasAnyTokenData = computed(
  () => totalPromptTokens.value > 0 || totalCompletionTokens.value > 0,
)

const isInProgress = computed(() => {
  if (!detail.value) return false
  return !detail.value.thread.finishedAt
})

function hasClassifyTrace(m: any): boolean {
  if (!m) return false
  if (m.role !== 'user') return false
  return Boolean(
    m.classifyIntent ||
      m.classifySource ||
      m.classifyReason ||
      m.routeKey ||
      m.processDurationMs != null,
  )
}

function isRecoveryMessage(m: any): boolean {
  return m?.classifySource === 'recovery'
}

// ============================================================
// 工具
// ============================================================
function fmtTime(d: string): string {
  if (!d) return '-'
  const dt = new Date(d)
  const hh = String(dt.getHours()).padStart(2, '0')
  const mm = String(dt.getMinutes()).padStart(2, '0')
  const ss = String(dt.getSeconds()).padStart(2, '0')
  const ms = String(dt.getMilliseconds()).padStart(3, '0')
  return `${hh}:${mm}:${ss}.${ms}`
}

function fmtDuration(ms: number | null): string {
  if (ms == null) return '-'
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(2)}s`
}

function fmtTokens(t: number | null): string {
  if (t == null) return '-'
  if (t < 1000) return String(t)
  return `${(t / 1000).toFixed(1)}k`
}

const ANGLE_LABELS: Record<string, string> = {
  definition: '定义',
  application: '应用',
  contrast: '对比',
  'edge-case': '边界',
}

function angleLabel(a: string | null | undefined): string {
  if (!a) return '-'
  return ANGLE_LABELS[a] ?? a
}

// ★ 原题生成时的 LLM 调用（用于展示 token）
const originalQuestionLlmCall = computed(() => {
  if (!detail.value) return null
  return (
    detail.value.llmCalls.find(
      (l) => l.callType === 'generate_question',
    ) ?? null
  )
})

function verdictLabel(v: string | null | undefined): string {
  const m: Record<string, string> = {
    correct: '正确',
    partial: '部分对',
    wrong: '错误',
    missing: '未答',
  }
  return m[v ?? ''] ?? (v ?? '-')
}

function verdictTagType(v: string | null | undefined): string {
  const m: Record<string, string> = {
    correct: 'success',
    partial: 'warning',
    wrong: 'danger',
    missing: 'info',
  }
  return m[v ?? ''] ?? 'info'
}

function roleLabel(role: string): string {
  return role === 'user' ? '用户' : role === 'system' ? '系统' : role
}

function msgTypeLabel(t: string | null): string {
  if (!t) return ''
  const m: Record<string, string> = {
    question: '题目',
    judgement: '反馈',
    hint: '提示',
    'retry-question': '追问',
    end: '结束',
    card: '卡片',
    clarify: '澄清',
  }
  return m[t] ?? t
}

function llmCallTypeLabel(t: string): string {
  const m: Record<string, string> = {
    judge_initial: '原题判分',
    judge_retry: '追问判分',
    discuss: '讨论回复',
    generate_question: '出题',
    generate_contrast: '出对比题',
    generate_causal: '出因果题',
    generate_retry_question: '生成追问题',
    classify_intent: '意图分类',
    merge: '节点合并',
  }
  return m[t] ?? t
}

function statusTagType(s: string): string {
  const m: Record<string, string> = {
    success: 'success',
    error: 'danger',
    schema_error: 'warning',
    timeout: 'warning',
  }
  return m[s] ?? 'info'
}

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text).catch(() => {
    /* ignore */
  })
}

function displayConceptName(t: TraceRecentThreadItem): string {
  const raw = (t as any).conceptName
  if (typeof raw === 'string' && raw.trim()) return raw
  return (t.conceptId ?? '').slice(0, 8) || '(未知概念)'
}
</script>

<template>
  <div class="trace-page">
    <!-- 左侧：thread 列表 -->
    <aside class="trace-sidebar">
      <div class="sidebar-header">
        <div class="title">Trace 观测</div>
        <el-button size="small" @click="loadRecentThreads" :loading="listLoading">
          刷新
        </el-button>
      </div>

      <div class="search-box">
        <el-input
          v-model="searchInput"
          placeholder="输入 threadId"
          size="small"
          clearable
          @keyup.enter="onSearch"
        >
          <template #append>
            <el-button size="small" @click="onSearch">查询</el-button>
          </template>
        </el-input>
      </div>

      <div class="thread-list" v-loading="listLoading">
        <el-empty
          v-if="!listLoading && recentThreads.length === 0"
          description="暂无数据"
          :image-size="60"
        />

        <div
          v-for="t in recentThreads"
          :key="t.threadId"
          class="thread-item"
          :class="{ 'is-active': selectedThreadId === t.threadId }"
          @click="onSelectThread(t.threadId)"
        >
          <div class="thread-item-top">
            <span class="concept-name" :title="displayConceptName(t)">
              {{ displayConceptName(t) }}
            </span>
            <el-tag
              v-if="t.originalAngle"
              size="small"
              effect="plain"
              type="info"
            >
              {{ angleLabel(t.originalAngle) }}
            </el-tag>
            <el-tag
              :type="verdictTagType(t.finalVerdict)"
              size="small"
              effect="plain"
            >
              {{ verdictLabel(t.finalVerdict) }}
            </el-tag>
          </div>

          <div class="thread-item-meta">
            <span class="thread-time">{{ fmtTime(t.startedAt) }}</span>
            <span v-if="t.finalScore != null" class="thread-score">
              {{ t.finalScore }}分
            </span>
            <span v-if="t.retryRounds > 0" class="thread-retry">
              追问{{ t.retryRounds }}
            </span>
          </div>

          <div class="thread-id-small" :title="t.threadId">
            {{ t.threadId.slice(0, 8) }}
          </div>
        </div>
      </div>

      <div v-if="listError" class="list-error">{{ listError }}</div>
    </aside>

    <!-- 右侧：详情 -->
    <main class="trace-main">
      <el-empty
        v-if="!selectedThreadId"
        description="从左侧选择一个 thread，或输入 threadId 查询"
      />

      <div v-else-if="detailLoading" class="loading-box" v-loading="true" />

      <el-result
        v-else-if="detailError"
        icon="error"
        :title="detailError"
      />

      <div v-else-if="detail" class="detail-wrap">
        <!-- 顶部 summary -->
        <div class="thread-summary">
          <div class="summary-left">
            <div class="concept-name">{{ detail.thread.conceptName }}</div>
            <div class="summary-meta">
              <el-tag size="small" effect="plain">
                {{ angleLabel(detail.thread.originalAngle) }}
              </el-tag>
              <el-tag
                :type="verdictTagType(detail.thread.finalVerdict)"
                size="small"
              >
                {{ verdictLabel(detail.thread.finalVerdict) }}
              </el-tag>
              <span v-if="detail.thread.finalScore != null" class="score">
                {{ detail.thread.finalScore }} 分
              </span>
              <span v-if="detail.thread.retryRounds > 0" class="meta-label">
                追问 {{ detail.thread.retryRounds }} 轮
              </span>
              <span
                v-if="detail.thread.discussionRounds > 0"
                class="meta-label"
              >
                讨论 {{ detail.thread.discussionRounds }} 轮
              </span>
            </div>
            <div class="thread-id-full">
              threadId: {{ detail.thread.id }}
            </div>
          </div>
          <div class="summary-right">
            <div class="summary-stat">
              <div class="stat-label">消息</div>
              <div class="stat-value">{{ detail.messages.length }}</div>
            </div>
            <div class="summary-stat">
              <div class="stat-label">判分</div>
              <div class="stat-value">{{ detail.judgements.length }}</div>
            </div>
            <div
              class="summary-stat"
              :class="{ 'is-empty': detail.llmCalls.length === 0 }"
            >
              <div class="stat-label">LLM 调用</div>
              <div class="stat-value">{{ detail.llmCalls.length }}</div>
              <!-- ★ 有调用 + 有 token 数据 → 展示 token + 耗时 -->
              <div
                v-if="detail.llmCalls.length > 0 && hasAnyTokenData"
                class="stat-hint stat-hint-llm"
              >
                ↑{{ fmtTokens(totalPromptTokens) }}
                ↓{{ fmtTokens(totalCompletionTokens) }}
                · {{ fmtDuration(totalDurationMs) }}
                <span
                  v-if="cacheHitRate != null"
                  class="stat-hint stat-hint-cache"
                >
                  (缓存 {{ (cacheHitRate * 100).toFixed(0) }}%)
                </span>
              </div>
              <!-- ★ 新增：缓存命中率 -->
              
              <div
                v-if="isInProgress && detail.llmCalls.length === 0"
                class="stat-hint"
              >
                进行中
              </div>
              <div v-else-if="isAbnormalThread" class="stat-hint stat-hint-error">
                判分异常
              </div>
              <div v-else-if="isLegacyThread" class="stat-hint">
                老数据
              </div>
            </div>
          </div>
        </div>

        <!-- 原题 -->
        <div v-if="detail.thread.originalQuestion" class="original-question">
          <div class="oq-label">
            原题
            <el-tag
              v-if="detail.thread.originalQuestionSource === 'llm'"
              size="small"
              type="primary"
              effect="plain"
              class="question-source-tag"
            >
              LLM 出题
            </el-tag>
            <el-tag
              v-else-if="detail.thread.originalQuestionSource === 'pool'"
              size="small"
              type="info"
              effect="plain"
              class="question-source-tag"
            >
              题库复用
            </el-tag>
          </div>
          <div class="oq-text">{{ detail.thread.originalQuestion }}</div>
          <div
            v-if="detail.thread.originalQuestionKeyPoints.length > 0"
            class="oq-kps"
          >
            <div class="oq-kps-label">评分要点</div>
            <ul>
              <li
                v-for="(kp, i) in detail.thread.originalQuestionKeyPoints"
                :key="i"
              >
                {{ kp }}
              </li>
            </ul>
          </div>
        </div>

        <!-- 时间线 -->
        <div class="timeline">
          <div class="timeline-title">事件时间线</div>

          <el-alert
            v-if="isInProgress"
            type="warning"
            :closable="false"
            show-icon
            title="进行中"
            description="该 thread 尚未完成（用户还没答题或未结束），无判分数据是正常的。"
            style="margin-bottom: 16px;"
          />
          <el-alert
            v-else-if="isAbnormalThread"
            type="error"
            :closable="false"
            show-icon
            title="判分链路异常"
            description="用户已提交答案，但系统跳过了判分（无 judgement、无 LLM 调用）。这通常是业务 bug（如一致性检查误拦截），不是用户未答。"
            style="margin-bottom: 16px;"
          />
          <el-alert
            v-else-if="isLegacyThread"
            type="info"
            :closable="false"
            show-icon
            title="老数据提示"
            description="该 thread 产生于 LLM 观测接入前，缺少 LLM 调用日志、意图分类、决策轨迹。想看完整数据请新跑一道题。"
            style="margin-bottom: 16px;"
          />

          <div
            v-for="(evt, idx) in timeline"
            :key="idx"
            class="timeline-item"
            :class="`kind-${evt.kind}`"
          >
            <div class="timeline-marker">
              <div class="marker-dot" />
              <div v-if="idx < timeline.length - 1" class="marker-line" />
            </div>

            <div class="timeline-content">
              <div class="event-time">{{ fmtTime(evt.at) }}</div>

              <!-- Message 卡片 -->
              <div v-if="evt.kind === 'message'" class="event-card message-card">
                <div class="card-header">
                  <span class="card-tag" :class="`role-${evt.data.role}`">
                    {{ roleLabel(evt.data.role) }}
                  </span>
                  <span v-if="evt.data.type" class="card-subtag">
                    {{ msgTypeLabel(evt.data.type) }}
                  </span>

                  <!-- ★ recovery 徽标 -->
                  <el-tag
                    v-if="isRecoveryMessage(evt.data)"
                    size="small"
                    type="warning"
                    effect="dark"
                  >
                    recovery
                  </el-tag>

                  <!-- ★ 题目来源徽标（只对 question 类型显示） -->
                  <template
                    v-if="
                      evt.data.type === 'question' &&
                      evt.data.payload?.questionSource
                    "
                  >
                    <el-tag
                      v-if="evt.data.payload.questionSource === 'llm'"
                      size="small"
                      type="primary"
                      effect="plain"
                    >
                      LLM 出题
                    </el-tag>
                    <el-tag
                      v-else-if="evt.data.payload.questionSource === 'pool'"
                      size="small"
                      type="info"
                      effect="plain"
                    >
                      题库复用
                    </el-tag>
                  </template>
                </div>

                <div class="card-content">{{ evt.data.content }}</div>

                <!-- classify / recovery 元信息 -->
                <div
                  v-if="hasClassifyTrace(evt.data)"
                  class="classify-meta"
                  :class="{ 'is-recovery': isRecoveryMessage(evt.data) }"
                >
                  <template v-if="isRecoveryMessage(evt.data)">
                    <div class="meta-row">
                      <span class="meta-key">recovery</span>
                      <span class="meta-val">
                        <el-tag size="small" type="warning">
                          被一致性检查拦截
                        </el-tag>
                        <span
                          v-if="evt.data.classifyReason"
                          class="meta-sub"
                        >
                          {{ evt.data.classifyReason }}
                        </span>
                      </span>
                    </div>
                  </template>

                  <template v-else>
                    <div v-if="evt.data.classifyIntent" class="meta-row">
                      <span class="meta-key">classify</span>
                      <span class="meta-val">
                        {{ evt.data.classifyIntent }}
                        <span v-if="evt.data.classifyConfidence != null">
                          ({{ evt.data.classifyConfidence.toFixed(2) }})
                        </span>
                        <span
                          v-if="evt.data.classifySource"
                          class="meta-sub"
                        >
                          via {{ evt.data.classifySource }}
                        </span>
                      </span>
                    </div>
                  </template>

                  <div v-if="evt.data.routeKey" class="meta-row">
                    <span class="meta-key">route</span>
                    <span class="meta-val">{{ evt.data.routeKey }}</span>
                  </div>

                  <div
                    v-if="evt.data.processDurationMs != null"
                    class="meta-row"
                  >
                    <span class="meta-key">耗时</span>
                    <span class="meta-val">
                      {{ fmtDuration(evt.data.processDurationMs) }}
                    </span>
                  </div>

                  <div
                    v-if="evt.data.classifyReason && !isRecoveryMessage(evt.data)"
                    class="meta-row"
                  >
                    <span class="meta-key">理由</span>
                    <span class="meta-val">{{ evt.data.classifyReason }}</span>
                  </div>
                </div>
              </div>

              <!-- Judgement 卡片 -->
              <div
                v-else-if="evt.kind === 'judgement'"
                class="event-card judgement-card"
              >
                <div class="card-header">
                  <span class="card-tag tag-judgement">
                    判分 · {{ evt.data.trigger }}
                    <span v-if="evt.data.trigger === 'retry'">
                      (第 {{ evt.data.retryRound }} 轮)
                    </span>
                  </span>
                  <el-tag
                    :type="verdictTagType(evt.data.verdict)"
                    size="small"
                  >
                    {{ verdictLabel(evt.data.verdict) }}
                  </el-tag>
                  <span class="score">{{ evt.data.score }} 分</span>
                </div>

                <div class="judgement-body">
                  <div
                    v-if="evt.data.hitPoints?.length"
                    class="group group-hit"
                  >
                    <div class="group-title">
                      ✅ 命中 {{ evt.data.hitPoints.length }}
                    </div>
                    <ul>
                      <li
                        v-for="(p, i) in evt.data.hitPoints"
                        :key="i"
                      >
                        {{ p.summary }}
                      </li>
                    </ul>
                  </div>

                  <div
                    v-if="evt.data.missingPoints?.length"
                    class="group group-miss"
                  >
                    <div class="group-title">
                      ⚠️ 遗漏 {{ evt.data.missingPoints.length }}
                    </div>
                    <ul>
                      <li
                        v-for="(p, i) in evt.data.missingPoints"
                        :key="i"
                      >
                        {{ p.summary }}
                        <span
                          v-if="p.type || p.importance"
                          class="mini-tag-group"
                        >
                          <span v-if="p.type" class="mini-tag">
                            {{ p.type }}
                          </span>
                          <span
                            v-if="p.importance"
                            class="mini-tag"
                            :class="p.importance === 'core' ? 'tag-core' : ''"
                          >
                            {{ p.importance }}
                          </span>
                        </span>
                      </li>
                    </ul>
                  </div>

                  <div
                    v-if="evt.data.wrongPoints?.length"
                    class="group group-wrong"
                  >
                    <div class="group-title">
                      ❌ 错误 {{ evt.data.wrongPoints.length }}
                    </div>
                    <ul>
                      <li
                        v-for="(p, i) in evt.data.wrongPoints"
                        :key="i"
                      >
                        {{ p.summary }}
                        <span
                          v-if="p.errorType || p.severity"
                          class="mini-tag-group"
                        >
                          <span
                            v-if="p.errorType"
                            class="mini-tag"
                          >
                            {{ p.errorType }}
                          </span>
                          <span
                            v-if="p.severity"
                            class="mini-tag"
                            :class="p.severity === 'critical' ? 'tag-core' : ''"
                          >
                            {{ p.severity }}
                          </span>
                        </span>
                      </li>
                    </ul>
                  </div>
                </div>

                <div
                  v-if="evt.data.decisionType"
                  class="decision-block"
                >
                  <div class="decision-title">🧠 决策</div>
                  <div class="decision-row">
                    <span class="d-key">type</span>
                    <el-tag
                      size="small"
                      :type="evt.data.decisionType === 'retry' ? 'warning' : 'primary'"
                    >
                      {{ evt.data.decisionType }}
                    </el-tag>
                  </div>
                  <div
                    v-if="evt.data.decisionForceAngle"
                    class="decision-row"
                  >
                    <span class="d-key">forceAngle</span>
                    <span class="d-val">{{ evt.data.decisionForceAngle }}</span>
                  </div>
                  <div
                    v-if="evt.data.decisionReason"
                    class="decision-row"
                  >
                    <span class="d-key">reason</span>
                    <span class="d-val">{{ evt.data.decisionReason }}</span>
                  </div>
                </div>

                <div v-if="evt.data.feedback" class="feedback-block">
                  <span class="feedback-label">feedback:</span>
                  {{ evt.data.feedback }}
                </div>

                <div
                  v-if="evt.data.revisedByDiscussion"
                  class="revision-flag"
                >
                  讨论修正 · 失效={{ !evt.data.isEffective }}
                </div>
              </div>

              <!-- LLM 调用卡片 -->
              <div
                v-else-if="evt.kind === 'llm'"
                class="event-card llm-card"
              >
                <div class="card-header">
                  <span class="card-tag tag-llm">
                    {{ llmCallTypeLabel(evt.data.callType) }}
                  </span>
                  <el-tag
                    :type="statusTagType(evt.data.status)"
                    size="small"
                    effect="plain"
                  >
                    {{ evt.data.status }}
                  </el-tag>
                  <span class="llm-model">{{ evt.data.model }}</span>
                </div>

                <div class="llm-meta">
                  <span>{{ fmtDuration(evt.data.durationMs) }}</span>
                  <span v-if="evt.data.promptTokens != null">
                    ↑{{ fmtTokens(evt.data.promptTokens) }}
                  </span>
                  <span v-if="evt.data.completionTokens != null">
                    ↓{{ fmtTokens(evt.data.completionTokens) }}
                  </span>
                  <!-- ★ 新增：单条缓存命中率 -->
                  <span
                    v-if="
                      evt.data.promptCacheHitTokens != null &&
                      evt.data.promptTokens &&
                      evt.data.promptTokens > 0
                    "
                    class="llm-cache"
                  >
                    cache
                    {{
                      (
                        (evt.data.promptCacheHitTokens /
                          evt.data.promptTokens) *
                        100
                      ).toFixed(0)
                    }}%
                  </span>
                </div>

                <details class="collapsible">
                  <summary>prompt（{{ evt.data.prompt.length }} 字符）</summary>
                  <div class="collapsible-body">
                    <div class="copy-row">
                      <el-button
                        size="small"
                        text
                        @click="copyToClipboard(evt.data.prompt)"
                      >
                        复制
                      </el-button>
                    </div>
                    <pre class="code-block">{{ evt.data.prompt }}</pre>
                  </div>
                </details>

                <details v-if="evt.data.responseParsed" class="collapsible">
                  <summary>response（结构化）</summary>
                  <div class="collapsible-body">
                    <pre class="code-block">{{ JSON.stringify(evt.data.responseParsed, null, 2) }}</pre>
                  </div>
                </details>
                <details v-else-if="evt.data.responseRaw" class="collapsible">
                  <summary>response（原始文本）</summary>
                  <div class="collapsible-body">
                    <pre class="code-block">{{ evt.data.responseRaw }}</pre>
                  </div>
                </details>

                <div v-if="evt.data.errorMessage" class="llm-error">
                  ❌ {{ evt.data.errorMessage }}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>

<style scoped lang="scss">
.trace-page {
  display: flex;
  height: 100vh;
  background: #f5f7fa;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}

.oq-label .question-source-tag {
  margin-left: 8px;
  vertical-align: middle;
}

.trace-sidebar {
  width: 300px;
  flex-shrink: 0;
  background: #fff;
  border-right: 1px solid #e5e7eb;
  display: flex;
  flex-direction: column;
}

.sidebar-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid #f0f0f0;

  .title {
    font-weight: 600;
    font-size: 15px;
    color: #1f1f1f;
  }
}

.search-box {
  padding: 12px 16px;
  border-bottom: 1px solid #f0f0f0;
}

.thread-list {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
}

.thread-item {
  padding: 10px 12px;
  border-radius: 6px;
  cursor: pointer;
  margin-bottom: 4px;
  transition: background 0.15s;

  &:hover {
    background: #f5f7fa;
  }

  &.is-active {
    background: #e6f4ff;
    border-left: 3px solid #409eff;
    padding-left: 9px;
  }

  .thread-item-top {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
    margin-bottom: 4px;

    .concept-name {
      font-size: 13px;
      font-weight: 600;
      color: #1f1f1f;
      flex: 1;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  }

  .thread-item-meta {
    display: flex;
    gap: 8px;
    font-size: 12px;
    color: #595959;
    margin-bottom: 2px;

    .thread-time {
      color: #8c8c8c;
      font-family: 'SF Mono', Menlo, Consolas, monospace;
    }

    .thread-score {
      color: #fa8c16;
    }

    .thread-retry {
      color: #b88230;
    }
  }

  .thread-id-small {
    font-size: 11px;
    color: #bfbfbf;
    font-family: 'SF Mono', Menlo, Consolas, monospace;
    line-height: 1.4;
  }
}

.list-error {
  padding: 12px 16px;
  color: #f5222d;
  font-size: 12px;
  border-top: 1px solid #f0f0f0;
}

.trace-main {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
}

.loading-box {
  min-height: 200px;
}

.detail-wrap {
  max-width: 1000px;
  margin: 0 auto;
}

.thread-summary {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 20px 24px;
  background: #fff;
  border-radius: 10px;
  border: 1px solid #e5e7eb;
  margin-bottom: 16px;

  .summary-left {
    flex: 1;
  }

  .concept-name {
    font-size: 20px;
    font-weight: 700;
    color: #1f1f1f;
    margin-bottom: 8px;
  }

  .summary-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
    font-size: 13px;

    .score {
      color: #fa8c16;
      font-weight: 500;
    }

    .meta-label {
      color: #8c8c8c;
    }
  }

  .thread-id-full {
    margin-top: 8px;
    font-size: 11px;
    color: #bfbfbf;
    font-family: 'SF Mono', Menlo, Consolas, monospace;
  }

  .summary-right {
    display: flex;
    gap: 24px;
    flex-shrink: 0;

    .summary-stat {
      text-align: center;

      .stat-label {
        font-size: 11px;
        color: #8c8c8c;
        margin-bottom: 4px;
      }

      .stat-value {
        font-size: 24px;
        font-weight: 700;
        color: #1f1f1f;
      }

      &.is-empty {
        .stat-value {
          color: #bfbfbf;
        }
      }
    }

    .stat-hint {
      margin-top: 2px;
      font-size: 10px;
      color: #bfbfbf;
    }
    .stat-hint.stat-hint-error {
      color: #f5222d;
      font-weight: 500;
    }
    /* ★ 新增：token 展示色 */
    .stat-hint.stat-hint-llm {
      color: #722ed1;
      font-family: 'SF Mono', Menlo, Consolas, monospace;
      font-weight: 500;
      white-space: nowrap;
      letter-spacing: 0.3px;
    }
    /* ★ 新增：缓存命中率展示色 */
    .stat-hint.stat-hint-cache {
      color: #52c41a;
      font-family: 'SF Mono', Menlo, Consolas, monospace;
      font-weight: 500;
      white-space: nowrap;
      letter-spacing: 0.3px;
    }
  }
}

.original-question {
  padding: 16px 20px;
  background: #fff;
  border-radius: 10px;
  border: 1px solid #e5e7eb;
  margin-bottom: 16px;
  border-left: 3px solid #409eff;

  .oq-label {
    font-size: 11px;
    font-weight: 600;
    color: #1890ff;
    margin-bottom: 6px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .oq-text {
    font-size: 14px;
    line-height: 1.7;
    color: #1f1f1f;
    margin-bottom: 10px;
  }

  .oq-kps {
    padding-top: 10px;
    border-top: 1px dashed #e5e7eb;

    .oq-kps-label {
      font-size: 12px;
      color: #8c8c8c;
      margin-bottom: 4px;
    }

    ul {
      margin: 0;
      padding-left: 20px;
      font-size: 13px;
      color: #595959;
      line-height: 1.7;
    }
  }
}

.timeline {
  background: #fff;
  border-radius: 10px;
  border: 1px solid #e5e7eb;
  padding: 20px 24px;

  .timeline-title {
    font-size: 13px;
    font-weight: 600;
    color: #8c8c8c;
    margin-bottom: 16px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
}

.timeline-item {
  display: flex;
  gap: 16px;
  position: relative;

  .timeline-marker {
    display: flex;
    flex-direction: column;
    align-items: center;
    flex-shrink: 0;
    width: 16px;
    padding-top: 6px;

    .marker-dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background: #d1d5db;
      flex-shrink: 0;
    }

    .marker-line {
      flex: 1;
      width: 2px;
      background: #e5e7eb;
      margin-top: 4px;
      min-height: 24px;
    }
  }

  &.kind-message .marker-dot {
    background: #52c41a;
  }
  &.kind-judgement .marker-dot {
    background: #fa8c16;
  }
  &.kind-llm .marker-dot {
    background: #722ed1;
  }

  .timeline-content {
    flex: 1;
    padding-bottom: 16px;
    min-width: 0;
  }

  .event-time {
    font-size: 11px;
    color: #bfbfbf;
    font-family: 'SF Mono', Menlo, Consolas, monospace;
    margin-bottom: 6px;
  }
}

.event-card {
  padding: 12px 16px;
  background: #fafafa;
  border-radius: 8px;
  border: 1px solid #f0f0f0;
}

.message-card {
  border-left: 3px solid #52c41a;
}

.judgement-card {
  border-left: 3px solid #fa8c16;
  background: #fffbe6;
}

.llm-card {
  border-left: 3px solid #722ed1;
  background: #f9f0ff;
}

.card-header {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 8px;
}

.card-tag {
  font-size: 11px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 3px;
  text-transform: uppercase;
  letter-spacing: 0.5px;

  &.role-user {
    background: #f6ffed;
    color: #52c41a;
  }

  &.role-system {
    background: #e6f4ff;
    color: #1890ff;
  }

  &.tag-judgement {
    background: #fff7e6;
    color: #fa8c16;
  }

  &.tag-llm {
    background: #f9f0ff;
    color: #722ed1;
  }
}

.card-subtag {
  font-size: 11px;
  color: #8c8c8c;
}

.score {
  font-size: 13px;
  font-weight: 600;
  color: #fa8c16;
}

.card-content {
  font-size: 13px;
  line-height: 1.7;
  color: #1f1f1f;
  white-space: pre-wrap;
  word-break: break-word;
}

.classify-meta {
  margin-top: 10px;
  padding: 8px 12px;
  background: #fff;
  border-radius: 6px;
  border: 1px dashed #d9d9d9;
  font-size: 12px;
  font-family: 'SF Mono', Menlo, Consolas, monospace;

  &.is-recovery {
    background: #fffbe6;
    border-color: #ffe7ba;
    border-style: solid;
  }

  .meta-row {
    display: flex;
    gap: 8px;
    margin-bottom: 4px;

    &:last-child {
      margin-bottom: 0;
    }
  }

  .meta-key {
    color: #8c8c8c;
    min-width: 60px;
    flex-shrink: 0;
  }

  .meta-val {
    color: #1f1f1f;
  }

  .meta-sub {
    color: #bfbfbf;
    margin-left: 4px;
  }
}

.judgement-body {
  margin-top: 8px;

  .group {
    margin-bottom: 8px;

    &:last-child {
      margin-bottom: 0;
    }

    .group-title {
      font-size: 12px;
      font-weight: 600;
      margin-bottom: 4px;
    }

    ul {
      margin: 0;
      padding-left: 20px;
      font-size: 12px;
      line-height: 1.7;
      color: #595959;

      li {
        margin-bottom: 2px;
      }
    }
  }

  .group-hit .group-title {
    color: #52c41a;
  }
  .group-miss .group-title {
    color: #fa8c16;
  }
  .group-wrong .group-title {
    color: #f5222d;
  }
}

.mini-tag-group {
  display: inline-flex;
  gap: 4px;
  margin-left: 6px;
  vertical-align: middle;
}

.mini-tag {
  display: inline-block;
  padding: 0 4px;
  font-size: 10px;
  background: #f5f5f5;
  color: #8c8c8c;
  border-radius: 2px;
  font-family: 'SF Mono', Menlo, Consolas, monospace;
  line-height: 1.5;

  &.tag-core {
    background: #fff1f0;
    color: #f5222d;
  }
}

.decision-block {
  margin-top: 10px;
  padding: 10px 12px;
  background: #fff;
  border-radius: 6px;
  border-left: 3px solid #1890ff;

  .decision-title {
    font-size: 12px;
    font-weight: 600;
    color: #1890ff;
    margin-bottom: 6px;
  }

  .decision-row {
    display: flex;
    gap: 8px;
    font-size: 12px;
    margin-bottom: 4px;

    &:last-child {
      margin-bottom: 0;
    }

    .d-key {
      color: #8c8c8c;
      min-width: 70px;
      flex-shrink: 0;
      font-family: 'SF Mono', Menlo, Consolas, monospace;
    }

    .d-val {
      color: #1f1f1f;
      line-height: 1.6;
    }
  }
}

.feedback-block {
  margin-top: 10px;
  padding: 10px 12px;
  background: #fff;
  border-radius: 6px;
  font-size: 12px;
  line-height: 1.7;
  color: #595959;

  .feedback-label {
    font-weight: 600;
    color: #8c8c8c;
    margin-right: 4px;
  }
}

.revision-flag {
  margin-top: 8px;
  font-size: 11px;
  color: #f5222d;
  padding: 2px 8px;
  background: #fff1f0;
  border-radius: 3px;
  display: inline-block;
}

.llm-model {
  margin-left: auto;
  font-size: 11px;
  color: #722ed1;
  font-family: 'SF Mono', Menlo, Consolas, monospace;
}

.llm-meta {
  display: flex;
  gap: 12px;
  font-size: 11px;
  color: #8c8c8c;
  margin-bottom: 8px;
  font-family: 'SF Mono', Menlo, Consolas, monospace;
}

/* ★ 新增：单条 cache 命中率 */
.llm-cache {
  color: #52c41a;
  font-weight: 500;
}

.collapsible {
  margin-top: 8px;
  border: 1px solid #f0f0f0;
  border-radius: 6px;
  background: #fff;

  summary {
    cursor: pointer;
    padding: 8px 12px;
    font-size: 12px;
    font-weight: 500;
    color: #722ed1;
    user-select: none;

    &:hover {
      background: #faf5ff;
    }
  }

  .collapsible-body {
    padding: 8px 12px;
    border-top: 1px solid #f0f0f0;
  }
}

.copy-row {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 4px;
}

.code-block {
  margin: 0;
  padding: 10px;
  background: #fafafa;
  border-radius: 4px;
  font-size: 11px;
  line-height: 1.6;
  color: #1f1f1f;
  font-family: 'SF Mono', Menlo, Consolas, monospace;
  white-space: pre-wrap;
  word-break: break-word;
  max-height: 400px;
  overflow-y: auto;
}

.llm-error {
  margin-top: 8px;
  padding: 8px 12px;
  background: #fff1f0;
  color: #f5222d;
  border-radius: 4px;
  font-size: 12px;
}
</style>