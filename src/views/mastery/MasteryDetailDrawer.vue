<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import {
  fetchConceptDetail,
  type ConceptDetail,
  type Angle,
  type Verdict,
} from '@/api/mastery'

const props = defineProps<{
  conceptId: string | null
  conceptName?: string | null
}>()

const loading = ref(false)
const detail = ref<ConceptDetail | null>(null)

const ANGLE_LABELS: Record<Angle, string> = {
  definition: '定义',
  application: '应用',
  contrast: '对比',
  'edge-case': '边界',
}
const ANGLE_ORDER: Angle[] = ['definition', 'application', 'contrast', 'edge-case']

const verdictText: Record<Verdict, string> = {
  correct: '答对',
  partial: '部分对',
  wrong: '答错',
  missing: '未答',
}
const verdictColor: Record<Verdict, 'success' | 'warning' | 'danger' | 'info'> = {
  correct: 'success',
  partial: 'warning',
  wrong: 'danger',
  missing: 'info',
}

const hasByAngle = computed(
  () => detail.value && Object.keys(detail.value.byAngle).length > 0,
)

watch(
  () => props.conceptId,
  async (id) => {
    if (!id) {
      detail.value = null
      return
    }
    loading.value = true
    detail.value = null
    try {
      detail.value = await fetchConceptDetail(id)
    } catch (err) {
      console.error('[mastery drawer] load failed:', err)
    } finally {
      loading.value = false
    }
  },
  { immediate: true },
)

function formatDate(d: string): string {
  return new Date(d).toLocaleString('zh-CN', { hour12: false })
}
</script>

<template>
  <div v-loading="loading" class="drawer-content">
    <el-empty v-if="!loading && !detail" description="未找到该概念" />

    <div v-else-if="detail" class="content">
      <!-- 掌握度总览 -->
      <div class="overview">
        <div class="overview-row">
          <span class="label">掌握度</span>
          <el-progress
            :percentage="Math.round(detail.masteryScore * 100)"
            :status="detail.masteryScore >= 0.8 ? 'success' : undefined"
            :stroke-width="16"
          />
        </div>
        <div class="meta">
          答过 {{ detail.totalAttempts }} 次 · 对 {{ detail.correctAttempts }} 次 ·
          最近：{{ detail.lastVerdict ? verdictText[detail.lastVerdict] : '未答过' }}
        </div>
      </div>

      <!-- 按题型 -->
      <div v-if="hasByAngle" class="section">
        <div class="section-title">按题型看</div>
        <div class="angle-list">
          <div
            v-for="angle in ANGLE_ORDER"
            :key="angle"
            v-show="detail.byAngle[angle]"
            class="angle-item"
          >
            <span class="angle-label">{{ ANGLE_LABELS[angle] }}</span>
            <el-progress
              :percentage="detail.byAngle[angle]?.avgScore ?? 0"
              :stroke-width="14"
            />
            <span class="angle-meta">{{ detail.byAngle[angle]?.attempts }} 次</span>
          </div>
        </div>
      </div>

      <!-- 答题记录 -->
      <div class="section">
        <div class="section-title">
          答题记录（最近 {{ detail.attempts.length }} 条）
        </div>
        <el-empty
          v-if="detail.attempts.length === 0"
          description="还没有答题记录"
          :image-size="60"
        />
        <el-timeline v-else>
          <el-timeline-item
            v-for="a in detail.attempts"
            :key="a.id"
            :timestamp="formatDate(a.answeredAt)"
            placement="top"
          >
            <div class="attempt-item">
              <el-tag v-if="a.angle" size="small" type="info">
                {{ ANGLE_LABELS[a.angle] }}
              </el-tag>
              <el-tag :type="verdictColor[a.verdict]" size="small">
                {{ verdictText[a.verdict] }}
              </el-tag>
              <span class="score">{{ a.score }} 分</span>
            </div>
          </el-timeline-item>
        </el-timeline>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.drawer-content {
  min-height: 200px;
}
.content {
  display: flex;
  flex-direction: column;
  gap: 24px;
}
.overview-row {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 10px;
}
.label {
  font-weight: 600;
  min-width: 60px;
}
.meta {
  font-size: 13px;
  color: #888;
}
.section-title {
  font-size: 13px;
  font-weight: 600;
  color: #303133;
  margin-bottom: 12px;
}
.angle-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.angle-item {
  display: flex;
  align-items: center;
  gap: 12px;
}
.angle-label {
  min-width: 50px;
  font-weight: 500;
  font-size: 13px;
}
.angle-meta {
  font-size: 12px;
  color: #888;
  min-width: 40px;
  text-align: right;
}
.attempt-item {
  display: flex;
  align-items: center;
  gap: 8px;
}
.score {
  margin-left: auto;
  font-weight: 600;
  color: #666;
}
</style>