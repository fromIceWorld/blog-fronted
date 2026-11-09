<script setup lang="ts">
import { ref, watch, defineComponent, h, type PropType } from 'vue'
import {
  getThreadDetail,
  type ThreadDetail,
} from '@/api/threads'

// ============================================================
// Props / Emits
// ============================================================
const props = defineProps<{
  visible: boolean
  threadId: string | null
}>()

const emit = defineEmits<{
  (e: 'update:visible', v: boolean): void
}>()

const drawerVisible = ref(props.visible)
watch(() => props.visible, (v) => (drawerVisible.value = v))
watch(drawerVisible, (v) => emit('update:visible', v))

// ============================================================
// 数据
// ============================================================
const detail = ref<ThreadDetail | null>(null)
const loading = ref(false)

watch(
  () => [props.visible, props.threadId] as const,
  async ([vis, id]) => {
    if (!vis || !id) return
    loading.value = true
    try {
      const res = await getThreadDetail(id)
      detail.value = res
    } catch (err: any) {
      console.error('[ThreadDetail] load failed', err)
      detail.value = null
    } finally {
      loading.value = false
    }
  },
  { immediate: true },
)

// ============================================================
// 工具：标签映射
// ============================================================
const ANGLE_LABELS: Record<string, string> = {
  definition: '定义',
  application: '应用',
  contrast: '对比',
  'edge-case': '边界',
}

const MISSING_TYPE_LABELS: Record<string, string> = {
  definition: '定义',
  application: '应用',
  contrast: '对比',
  'edge-case': '边界',
  other: '其他',
}

const ERROR_TYPE_LABELS: Record<string, string> = {
  confusion: '概念混淆',
  incomplete: '不完整',
  incorrect: '事实错误',
}

const DECISION_LABELS: Record<string, string> = {
  retry: '追问',
  'next-question': '下一题',
  discuss: '讨论',
}

function angleLabel(a: string | undefined | null): string {
  if (!a) return '-'
  return ANGLE_LABELS[a] ?? a
}

function missingTypeLabel(t: string | undefined | null): string {
  if (!t) return '其他'
  return MISSING_TYPE_LABELS[t] ?? t
}

function errorTypeLabel(t: string | undefined | null): string {
  if (!t) return '事实错误'
  return ERROR_TYPE_LABELS[t] ?? t
}

function decisionLabel(d: string | undefined | null): string {
  if (!d) return '-'
  return DECISION_LABELS[d] ?? d
}

function importanceLabel(v: string | undefined | null): string {
  return v === 'core' ? '核心' : '补充'
}

function severityLabel(s: string | undefined | null): string {
  return s === 'critical' ? '严重' : '轻微'
}

function verdictLabel(v: string | null): string {
  if (!v) return '-'
  const map: Record<string, string> = {
    correct: '正确',
    partial: '部分对',
    wrong: '错误',
    missing: '未答',
  }
  return map[v] ?? v
}

function verdictType(
  v: string | null,
): 'success' | 'warning' | 'danger' | 'info' {
  if (v === 'correct') return 'success'
  if (v === 'partial') return 'warning'
  if (v === 'wrong') return 'danger'
  return 'info'
}

function formatDate(d: string | null): string {
  if (!d) return '-'
  return new Date(d).toLocaleString('zh-CN')
}

function statusLabel(s: string): string {
  const map: Record<string, string> = {
    active: '进行中',
    completed: '已完成',
    abandoned: '已放弃',
  }
  return map[s] ?? s
}

function topVerdictText(d: ThreadDetail): string {
  const v = d.finalVerdict
  const r = d.retryRounds

  if (v === 'correct') {
    if (r === 0) return '✅ 一次答对'
    return `✅ 通过追问补齐`
  }
  if (v === 'partial') {
    return '⚠️ 部分掌握'
  }
  if (v === 'wrong') {
    return '❌ 答错了'
  }
  return '⏭️ 未作答'
}

function masteryHint(w: number | null | undefined): string {
  if (w == null) return ''
  if (w >= 0.9) return '掌握度贡献极高'
  if (w >= 0.6) return '掌握度贡献中等'
  if (w >= 0.4) return '掌握度贡献较低'
  return '掌握度贡献低'
}

// ============================================================
// 子组件：判分明细
// （定义在 <script setup> 内，才能闭包访问上面的 label 函数）
// ============================================================
interface JudgementPoint {
  summary: string
  type?: string
  importance?: string
  reason?: string
  severity?: string
  errorType?: string
}

interface JudgementLike {
  verdict: string | null
  score: number
  correctness?: number | null
  completeness?: number | null
  hitPoints?: JudgementPoint[]
  missingPoints?: JudgementPoint[]
  wrongPoints?: JudgementPoint[]
  feedback?: string
}

const JudgementPanel = defineComponent({
  name: 'JudgementPanel',
  props: {
    judgement: {
      type: Object as PropType<JudgementLike | null>,
      default: null,
    },
  },
  setup(props) {
    // ★ 兼容 string / 对象两种格式（老数据兜底）
    const normalize = (p: any): JudgementPoint => {
      if (typeof p === 'string') return { summary: p }
      if (p && typeof p.summary === 'string') return p
      return { summary: String(p ?? '') }
    }

    return () => {
      const j = props.judgement
      if (!j) return null

      const hitPoints = (j.hitPoints ?? []).map(normalize)
      const missingPoints = (j.missingPoints ?? []).map(normalize)
      const wrongPoints = (j.wrongPoints ?? []).map(normalize)

      const children: any[] = []

      // 头部
      children.push(
        h('div', { class: 'jp-header' }, [
          h(
            'span',
            { class: `jp-verdict jp-verdict-${j.verdict ?? 'missing'}` },
            verdictLabel(j.verdict),
          ),
          h('span', { class: 'jp-score' }, `${j.score} 分`),
        ]),
      )

      // 命中
      if (hitPoints.length > 0) {
        children.push(
          h('div', { class: 'jp-group jp-group-hit' }, [
            h(
              'div',
              { class: 'jp-group-title' },
              `✅ 命中 ${hitPoints.length} 条`,
            ),
            h(
              'ul',
              {},
              hitPoints.map((p, i) => h('li', { key: i }, p.summary)),
            ),
          ]),
        )
      }

      // 遗漏
      if (missingPoints.length > 0) {
        children.push(
          h('div', { class: 'jp-group jp-group-missing' }, [
            h(
              'div',
              { class: 'jp-group-title' },
              `⚠️ 遗漏 ${missingPoints.length} 条`,
            ),
            h(
              'ul',
              {},
              missingPoints.map((p, i) =>
                h('li', { key: i }, [
                  h('span', { class: 'jp-point-text' }, p.summary),
                  h('span', { class: 'jp-tags' }, [
                    h(
                      'span',
                      { class: `jp-tag jp-tag-type-${p.type ?? 'other'}` },
                      missingTypeLabel(p.type),
                    ),
                    h(
                      'span',
                      {
                        class: `jp-tag jp-tag-importance-${p.importance ?? 'supplementary'}`,
                      },
                      importanceLabel(p.importance),
                    ),
                  ]),
                ]),
              ),
            ),
          ]),
        )
      }

      // 错误
      if (wrongPoints.length > 0) {
        children.push(
          h('div', { class: 'jp-group jp-group-wrong' }, [
            h(
              'div',
              { class: 'jp-group-title' },
              `❌ 错误 ${wrongPoints.length} 条`,
            ),
            h(
              'ul',
              {},
              wrongPoints.map((p, i) =>
                h('li', { key: i }, [
                  h('div', { class: 'jp-wrong-summary' }, p.summary),
                  p.reason
                    ? h('div', { class: 'jp-wrong-reason' }, p.reason)
                    : null,
                  h('span', { class: 'jp-tags' }, [
                    h(
                      'span',
                      {
                        class: `jp-tag jp-tag-severity-${p.severity ?? 'minor'}`,
                      },
                      severityLabel(p.severity),
                    ),
                    h(
                      'span',
                      {
                        class: `jp-tag jp-tag-errortype-${p.errorType ?? 'incorrect'}`,
                      },
                      errorTypeLabel(p.errorType),
                    ),
                  ]),
                ]),
              ),
            ),
          ]),
        )
      }

      // 反馈
      if (j.feedback) {
        children.push(
          h('div', { class: 'jp-feedback' }, [
            h('strong', {}, 'LLM 反馈：'),
            h('span', {}, j.feedback),
          ]),
        )
      }

      return h('div', { class: 'judgement-panel' }, children)
    }
  },
})

// ============================================================
// 子组件：决策轨迹
// ============================================================
const DecisionTrace = defineComponent({
  name: 'DecisionTrace',
  props: {
    decisionType: { type: String as PropType<string | null>, default: null },
    decisionReason: {
      type: String as PropType<string | null>,
      default: null,
    },
    decisionForceAngle: {
      type: String as PropType<string | null>,
      default: null,
    },
  },
  setup(props) {
    return () => {
      if (!props.decisionType) return null

      const children: any[] = [
        h('div', { class: 'dt-title' }, '🧠 系统决策'),
        h('div', { class: 'dt-row' }, [
          h('span', { class: 'dt-label' }, '决策'),
          h(
            'span',
            { class: `dt-tag dt-tag-${props.decisionType}` },
            decisionLabel(props.decisionType),
          ),
        ]),
      ]

      if (props.decisionForceAngle) {
        children.push(
          h('div', { class: 'dt-row' }, [
            h('span', { class: 'dt-label' }, '下一题方向'),
            h(
              'span',
              { class: 'dt-value' },
              angleLabel(props.decisionForceAngle),
            ),
          ]),
        )
      }

      if (props.decisionReason) {
        children.push(
          h('div', { class: 'dt-row' }, [
            h('span', { class: 'dt-label' }, '决策理由'),
            h('span', { class: 'dt-reason' }, props.decisionReason),
          ]),
        )
      }

      return h('div', { class: 'decision-trace' }, children)
    }
  },
})
</script>

<template>
  <el-drawer
    v-model="drawerVisible"
    title="答题详情"
    size="760px"
    :destroy-on-close="true"
  >
    <div v-if="detail" v-loading="loading" class="detail-content">
      <!-- 顶部主结果 -->
      <div class="top-summary">
        <div class="top-left">
          <h2 class="top-verdict">{{ topVerdictText(detail) }}</h2>
          <div class="top-meta">
            <span class="concept-name">{{ detail.concept.name }}</span>
            <el-tag size="small" effect="plain">
              {{ angleLabel(detail.originalAngle) }}
            </el-tag>
            <el-tag
              v-if="detail.status !== 'completed'"
              size="small"
              type="warning"
            >
              {{ statusLabel(detail.status) }}
            </el-tag>
          </div>
        </div>
        <div class="top-right">
          <div v-if="detail.masteryWeight != null" class="mastery-hint">
            {{ masteryHint(detail.masteryWeight) }}
          </div>
          <div class="times">
            <div>{{ formatDate(detail.startedAt) }}</div>
            <div v-if="detail.finishedAt" class="end-time">
              → {{ formatDate(detail.finishedAt) }}
            </div>
          </div>
        </div>
      </div>

      <!-- 原题 -->
      <div v-if="detail.originalQuestion" class="card card-original">
        <div class="card-title">
          <span class="badge badge-original">原题</span>
          <span class="angle-hint">
            角度：{{ angleLabel(detail.originalQuestion.angle) }}
          </span>
        </div>

        <div class="question-text">{{ detail.originalQuestion.question }}</div>

        <!-- 评分要点 -->
        <div class="key-points">
          <div class="kps-label">
            评分要点（{{ detail.originalQuestion.keyPoints.length }}）
          </div>
          <ul>
            <li
              v-for="(kp, i) in detail.originalQuestion.keyPoints"
              :key="i"
            >
              {{ kp }}
            </li>
          </ul>
        </div>

        <!-- 用户答案 -->
        <div class="answer-block">
          <div class="answer-label">你的答案</div>
          <div class="answer-text">
            {{ detail.originalAnswer ?? '(无)' }}
          </div>
        </div>

        <!-- 判分明细 -->
        <JudgementPanel :judgement="detail.originalJudgement" />

        <!-- 决策轨迹 -->
        <DecisionTrace
          :decision-type="detail.originalJudgement?.decisionType"
          :decision-reason="detail.originalJudgement?.decisionReason"
          :decision-force-angle="detail.originalJudgement?.decisionForceAngle"
        />
      </div>

      <!-- 追问列表 -->
      <div
        v-for="retry in detail.retries"
        :key="retry.id"
        class="card card-retry"
      >
        <div class="card-title">
          <span class="badge badge-retry">追问 {{ retry.retryRound }}</span>
          <span v-if="retry.retryTargetPoint" class="target-point">
            针对：{{ retry.retryTargetPoint }}
          </span>
        </div>

        <div v-if="retry.retryQuestionText" class="question-text">
          {{ retry.retryQuestionText }}
        </div>

        <div class="answer-block">
          <div class="answer-label">你的答案</div>
          <div class="answer-text">{{ retry.userAnswer ?? '(无)' }}</div>
        </div>

        <JudgementPanel :judgement="retry" />
      </div>

      <!-- 底部汇总 -->
      <div class="bottom-summary">
        <span>掌握度贡献</span>
        <el-tag v-if="detail.masteryWeight != null" type="info" effect="plain">
          {{ (detail.masteryWeight * 100).toFixed(0) }}%
        </el-tag>
        <span v-else>—</span>
        <span class="divider">·</span>
        <span>追问 {{ detail.retryRounds }} 次</span>
        <span class="divider">·</span>
        <span>讨论 {{ detail.discussionRounds }} 轮</span>
      </div>
    </div>

    <el-empty v-else-if="!loading" description="暂无数据" />
  </el-drawer>
</template>

<style scoped lang="scss">
.detail-content {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.top-summary {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 20px 24px;
  background: linear-gradient(135deg, #f0f9ff 0%, #e6f4ff 100%);
  border-radius: 12px;
  border: 1px solid #d4e4fa;

  .top-left {
    flex: 1;
    min-width: 0;

    .top-verdict {
      margin: 0 0 8px;
      font-size: 22px;
      font-weight: 700;
      color: #1f1f1f;
      line-height: 1.3;
    }

    .top-meta {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
      font-size: 13px;

      .concept-name {
        font-weight: 600;
        color: #409eff;
      }
    }
  }

  .top-right {
    flex-shrink: 0;
    text-align: right;
    font-size: 12px;
    color: #8c8c8c;

    .mastery-hint {
      color: #52c41a;
      font-weight: 500;
      margin-bottom: 6px;
    }

    .end-time {
      margin-top: 2px;
    }
  }
}

.card {
  padding: 16px;
  border-radius: 10px;
  background: #fff;
  border: 1px solid #f0f0f0;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.card-original {
  border-left: 4px solid #409eff;
}

.card-retry {
  border-left: 4px solid #faad14;
  background: #fffdfa;
}

.card-title {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.badge {
  display: inline-block;
  padding: 2px 10px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 600;
}

.badge-original {
  background: #e6f7ff;
  color: #1890ff;
}

.badge-retry {
  background: #fff7e6;
  color: #fa8c16;
}

.angle-hint {
  font-size: 12px;
  color: #8c8c8c;
}

.target-point {
  font-size: 12px;
  color: #fa8c16;
  background: #fff7e6;
  padding: 2px 8px;
  border-radius: 4px;
}

.question-text {
  font-size: 14px;
  line-height: 1.7;
  color: #1f1f1f;
  padding: 12px 16px;
  background: #fafafa;
  border-radius: 6px;
  border-left: 3px solid #409eff;
}

.key-points {
  font-size: 13px;
  color: #595959;

  .kps-label {
    font-weight: 500;
    color: #8c8c8c;
    margin-bottom: 6px;
  }

  ul {
    margin: 0;
    padding-left: 20px;
    line-height: 1.7;
  }
}

.answer-block {
  padding: 12px 16px;
  background: #f6ffed;
  border-radius: 6px;
  border-left: 3px solid #52c41a;

  .answer-label {
    font-size: 12px;
    color: #52c41a;
    font-weight: 500;
    margin-bottom: 6px;
  }

  .answer-text {
    font-size: 14px;
    line-height: 1.7;
    color: #1f1f1f;
    white-space: pre-wrap;
  }
}

.bottom-summary {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  background: #fafafa;
  border-radius: 8px;
  font-size: 13px;
  color: #8c8c8c;

  .divider {
    color: #d9d9d9;
  }
}
</style>

<style lang="scss">
/* 判分明细面板（子组件内部结构，需要非 scoped） */
.judgement-panel {
  padding: 12px 16px;
  background: #fffbe6;
  border-radius: 8px;
  border-left: 3px solid #faad14;
}

.jp-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;

  .jp-verdict {
    font-size: 14px;
    font-weight: 600;
    padding: 2px 10px;
    border-radius: 4px;
  }

  .jp-verdict-correct { background: #f6ffed; color: #52c41a; }
  .jp-verdict-partial { background: #fff7e6; color: #fa8c16; }
  .jp-verdict-wrong { background: #fff1f0; color: #f5222d; }
  .jp-verdict-missing { background: #f5f5f5; color: #8c8c8c; }

  .jp-score {
    font-size: 13px;
    color: #faad14;
    font-weight: 600;
  }
}

.jp-group {
  margin-bottom: 10px;
  &:last-of-type { margin-bottom: 0; }

  .jp-group-title {
    font-size: 13px;
    font-weight: 600;
    margin-bottom: 6px;
  }

  ul {
    margin: 0;
    padding-left: 20px;

    li {
      font-size: 13px;
      line-height: 1.7;
      color: #595959;
      margin-bottom: 6px;
    }
  }
}

.jp-group-hit .jp-group-title { color: #52c41a; }
.jp-group-missing .jp-group-title { color: #fa8c16; }
.jp-group-wrong .jp-group-title { color: #f5222d; }

.jp-point-text { display: inline; }
.jp-wrong-summary { font-weight: 500; color: #1f1f1f; }
.jp-wrong-reason { font-size: 12px; color: #8c8c8c; margin-top: 2px; }

.jp-tags {
  display: inline-flex;
  gap: 4px;
  margin-left: 6px;
  vertical-align: middle;
}

.jp-tag {
  display: inline-block;
  padding: 1px 6px;
  border-radius: 3px;
  font-size: 11px;
  font-weight: 500;
}

.jp-tag-type-definition { background: #e6f4ff; color: #1890ff; }
.jp-tag-type-application { background: #f6ffed; color: #52c41a; }
.jp-tag-type-contrast { background: #fff7e6; color: #fa8c16; }
.jp-tag-type-edge-case { background: #fff1f0; color: #f5222d; }
.jp-tag-type-other { background: #f5f5f5; color: #8c8c8c; }

.jp-tag-importance-core {
  background: #fff1f0;
  color: #f5222d;
  border: 1px solid #ffccc7;
}
.jp-tag-importance-supplementary { background: #f5f5f5; color: #8c8c8c; }

.jp-tag-severity-critical { background: #fff1f0; color: #f5222d; }
.jp-tag-severity-minor { background: #fff7e6; color: #fa8c16; }

.jp-tag-errortype-confusion { background: #f9f0ff; color: #722ed1; }
.jp-tag-errortype-incomplete { background: #fff7e6; color: #fa8c16; }
.jp-tag-errortype-incorrect { background: #fff1f0; color: #f5222d; }

.jp-feedback {
  margin-top: 10px;
  padding: 10px 12px;
  background: #fff;
  border-radius: 6px;
  font-size: 13px;
  line-height: 1.7;
  color: #262626;

  strong {
    color: #8c8c8c;
    margin-right: 4px;
  }
}

/* 决策轨迹 */
.decision-trace {
  padding: 12px 16px;
  background: #f0f7ff;
  border-radius: 8px;
  border-left: 3px solid #409eff;
}

.dt-title {
  font-size: 13px;
  font-weight: 600;
  color: #1890ff;
  margin-bottom: 8px;
}

.dt-row {
  display: flex;
  gap: 12px;
  font-size: 13px;
  margin-bottom: 6px;
  &:last-child { margin-bottom: 0; }
}

.dt-label {
  min-width: 80px;
  color: #8c8c8c;
  flex-shrink: 0;
}

.dt-value,
.dt-reason {
  color: #1f1f1f;
  line-height: 1.7;
  flex: 1;
}

.dt-tag {
  display: inline-block;
  padding: 2px 10px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 600;
}

.dt-tag-retry { background: #fff7e6; color: #fa8c16; }
.dt-tag-next-question { background: #e6f4ff; color: #1890ff; }
.dt-tag-discuss { background: #f5f5f5; color: #8c8c8c; }
</style>