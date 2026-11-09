<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  getJudgementDetail,
  type JudgementDetail,
  type Verdict,
} from '@/api/judgements'

const route = useRoute()
const router = useRouter()
const loading = ref(true)
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

onMounted(async () => {
  const id = route.params.id as string
  try {
    detail.value = await getJudgementDetail(id)
  } finally {
    loading.value = false
  }
})

function formatDate(d: string): string {
  return new Date(d).toLocaleString('zh-CN', { hour12: false })
}

function totalKeyPoints(): number {
  if (!detail.value) return 0
  return detail.value.question?.keyPoints.length ?? 0
}
</script>

<template>
  <div v-loading="loading" class="judgement-detail">
    <el-page-header @back="router.back()">
      <template #content>
        <span>答题详情</span>
      </template>
    </el-page-header>

    <el-empty v-if="!loading && !detail" description="未找到该记录" />

    <div v-else-if="detail" class="content">
      <!-- 分数概览 -->
      <el-card class="overview">
        <div class="score-row">
          <div class="score-big">{{ detail.score }}</div>
          <div class="score-unit">分</div>
          <el-tag
            v-if="detail.verdict"
            :type="verdictColor[detail.verdict]"
            size="large"
            style="margin-left: 12px"
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
      </el-card>

      <!-- 题目 -->
      <el-card v-if="detail.question" class="section">
        <template #header>
          <div class="section-header">
            <span>题目</span>
            <div class="tags">
              <el-tag v-if="detail.question.angle" size="small" type="info">
                {{ angleText[detail.question.angle] ?? detail.question.angle }}
              </el-tag>
              <el-tag v-if="detail.question.intent" size="small" type="info" effect="plain">
                {{ intentText[detail.question.intent] ?? detail.question.intent }}
              </el-tag>
            </div>
          </div>
        </template>
        <p class="question-text">{{ detail.question.question }}</p>
      </el-card>

      <!-- 你的回答 -->
      <el-card v-if="detail.userAnswer" class="section">
        <template #header>你的回答</template>
        <p class="answer-text">{{ detail.userAnswer.content }}</p>
      </el-card>

      <!-- 逐条命中 -->
      <el-card class="section">
        <template #header>
          <span>评分明细（共 {{ totalKeyPoints() }} 条要点）</span>
        </template>

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
      </el-card>

      <!-- 反馈 -->
      <el-card v-if="detail.feedback" class="section feedback">
        <template #header>反馈</template>
        <p>{{ detail.feedback }}</p>
      </el-card>

      <!-- 题目要点（可选展开） -->
      <el-collapse v-if="detail.question" class="section">
        <el-collapse-item title="查看本题全部评分要点">
          <ol>
            <li v-for="(k, i) in detail.question.keyPoints" :key="i">{{ k }}</li>
          </ol>
        </el-collapse-item>
      </el-collapse>
    </div>
  </div>
</template>

<style scoped lang="scss">
.judgement-detail {
  max-width: 800px;
  margin: 0 auto;
  padding: 24px;
}
.content {
  margin-top: 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.overview {
  text-align: center;
}
.score-row {
  display: flex;
  align-items: baseline;
  justify-content: center;
  margin-bottom: 8px;
}
.score-big {
  font-size: 42px;
  font-weight: 700;
  color: #333;
}
.score-unit {
  font-size: 16px;
  color: #888;
  margin-left: 4px;
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
.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
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
}
.point-group {
  margin-bottom: 16px;
}
.point-group:last-child {
  margin-bottom: 0;
}
.point-label {
  font-weight: 600;
  margin-bottom: 6px;
}
.point-group ul {
  padding-left: 20px;
  margin: 0;
}
.point-group li {
  line-height: 1.6;
  margin-bottom: 4px;
}
.hit .point-label { color: #52c41a; }
.missing .point-label { color: #fa8c16; }
.wrong .point-label { color: #f5222d; }
.feedback p {
  line-height: 1.7;
  margin: 0;
  white-space: pre-wrap;
}
</style>