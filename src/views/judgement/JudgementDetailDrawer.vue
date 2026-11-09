<script setup lang="ts">
import { ref, watch } from 'vue'
import {
  getJudgementDetail,
  type JudgementDetail,
  type Verdict,
} from '@/api/judgements'

const props = defineProps<{
  judgementId: string | null
}>()

const visible = defineModel<boolean>({ required: true })

const loading = ref(false)
const detail = ref<JudgementDetail | null>(null)

const verdictText: Record<Verdict, string> = {
  correct: '答对',
  partial: '部分对',
  wrong: '答错',
  missing: '未答',
}
const verdictColor: Record<Verdict, string> = {
  correct: 'success',
  partial: 'warning',
  wrong: 'danger',
  missing: 'info',
}
const intentText: Record<string, string> = {
  list: '列举',
  explain: '解释',
  apply: '应用',
  compare: '对比',
  code: '代码',
}
const angleText: Record<string, string> = {
  definition: '定义',
  application: '应用',
  contrast: '对比',
  'edge-case': '边界',
}

watch(
  () => [visible.value, props.judgementId] as const,
  async ([v, id]) => {
    if (!v || !id) return
    loading.value = true
    detail.value = null
    try {
      detail.value = await getJudgementDetail(id)
    } catch (err) {
      detail.value = null
    } finally {
      loading.value = false
    }
  },
)

function formatDate(d: string): string {
  return new Date(d).toLocaleString('zh-CN', { hour12: false })
}

function totalKeyPoints(): number {
  return detail.value?.question?.keyPoints.length ?? 0
}
</script>

<template>
  <el-drawer
    v-model="visible"
    title="答题详情"
    size="560px"
    :destroy-on-close="true"
  >
    <div v-loading="loading" class="drawer-body">
      <el-empty v-if="!loading && !detail" description="未找到该记录" />

      <div v-else-if="detail" class="content">
        <!-- 分数概览 -->
        <div class="score-card">
          <div class="score-row">
            <span class="score-big">{{ detail.score }}</span>
            <span class="score-unit">分</span>
            <el-tag
              v-if="detail.verdict"
              :type="verdictColor[detail.verdict]"
              size="large"
              class="verdict-tag"
            >
              {{ verdictText[detail.verdict] }}
            </el-tag>
          </div>
          <div class="breakdown">
            <span v-if="detail.correctness !== null">
              正确性 {{ Math.round(detail.correctness * 100) }}%
            </span>
            <span v-if="detail.completeness !== null">
              完整性 {{ Math.round(detail.completeness * 100) }}%
            </span>
            <span class="time">{{ formatDate(detail.judgedAt) }}</span>
          </div>
        </div>

        <!-- 题目 -->
        <div v-if="detail.question" class="section">
          <div class="section-header">
            <span class="section-title">题目</span>
            <div class="tags">
              <el-tag v-if="detail.question.angle" size="small" type="info">
                {{ angleText[detail.question.angle] ?? detail.question.angle }}
              </el-tag>
              <el-tag v-if="detail.question.intent" size="small" type="info" effect="plain">
                {{ intentText[detail.question.intent] ?? detail.question.intent }}
              </el-tag>
            </div>
          </div>
          <p class="question-text">{{ detail.question.question }}</p>
        </div>

        <!-- 你的回答 -->
        <div v-if="detail.userAnswer" class="section">
          <div class="section-title">你的回答</div>
          <p class="answer-text">{{ detail.userAnswer.content }}</p>
        </div>

        <!-- 逐条命中 -->
        <div class="section">
          <div class="section-title">评分明细（共 {{ totalKeyPoints() }} 条要点）</div>

          <div v-if="detail.hitPoints.length > 0" class="point-group hit">
            <div class="point-label">✅ 命中 ({{ detail.hitPoints.length }})</div>
            <ul>
              <li v-for="(p, i) in detail.hitPoints" :key="i">{{ p }}</li>
            </ul>
          </div>

          <div v-if="detail.missingPoints.length > 0" class="point-group missing">
            <div class="point-label">❌ 遗漏 ({{ detail.missingPoints.length }})</div>
            <ul>
              <li v-for="(p, i) in detail.missingPoints" :key="i">{{ p }}</li>
            </ul>
          </div>

          <div v-if="detail.wrongPoints.length > 0" class="point-group wrong">
            <div class="point-label">⚠️ 错误 ({{ detail.wrongPoints.length }})</div>
            <ul>
              <li v-for="(p, i) in detail.wrongPoints" :key="i">{{ p }}</li>
            </ul>
          </div>
        </div>

        <!-- 反馈 -->
        <div v-if="detail.feedback" class="section feedback">
          <div class="section-title">反馈</div>
          <p>{{ detail.feedback }}</p>
        </div>

        <!-- 题目要点（折叠） -->
        <el-collapse v-if="detail.question" class="section">
          <el-collapse-item title="查看本题全部评分要点">
            <ol>
              <li v-for="(k, i) in detail.question.keyPoints" :key="i">{{ k }}</li>
            </ol>
          </el-collapse-item>
        </el-collapse>
      </div>
    </div>
  </el-drawer>
</template>

<style scoped lang="scss">
.drawer-body {
  min-height: 200px;
}
.content {
  display: flex;
  flex-direction: column;
  gap: 20px;
}
.score-card {
  text-align: center;
  padding: 16px;
  background: #f8f9fb;
  border-radius: 8px;
}
.score-row {
  display: flex;
  align-items: baseline;
  justify-content: center;
  margin-bottom: 8px;
}
.score-big {
  font-size: 38px;
  font-weight: 700;
  color: #333;
}
.score-unit {
  font-size: 14px;
  color: #888;
  margin-left: 4px;
}
.verdict-tag {
  margin-left: 12px;
}
.breakdown {
  display: flex;
  gap: 16px;
  justify-content: center;
  font-size: 13px;
  color: #666;
}
.time {
  color: #aaa;
}
.section {
  border-top: 1px solid #eee;
  padding-top: 16px;
}
.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}
.section-title {
  font-weight: 600;
  font-size: 14px;
  margin-bottom: 8px;
  display: block;
}
.tags {
  display: flex;
  gap: 6px;
}
.question-text,
.answer-text {
  white-space: pre-wrap;
  line-height: 1.7;
  margin: 0;
  font-size: 14px;
}
.point-group {
  margin-top: 12px;
}
.point-group:first-of-type {
  margin-top: 0;
}
.point-label {
  font-weight: 600;
  margin-bottom: 6px;
  font-size: 13px;
}
.point-group ul {
  padding-left: 20px;
  margin: 0;
}
.point-group li {
  line-height: 1.6;
  margin-bottom: 4px;
  font-size: 13px;
}
.hit .point-label { color: #52c41a; }
.missing .point-label { color: #fa8c16; }
.wrong .point-label { color: #f5222d; }
.feedback p {
  line-height: 1.7;
  margin: 0;
  white-space: pre-wrap;
  font-size: 14px;
}
</style>