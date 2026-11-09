<script setup lang="ts">
import JudgementDetailDrawer from './JudgementDetailDrawer.vue'

import { onMounted, ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import {
  listJudgements,
  type JudgementListItem,
  type Verdict,
} from '@/api/judgements'

const router = useRouter()

const drawerVisible = ref(false)
const selectedId = ref<string | null>(null)

const loading = ref(true)
const items = ref<JudgementListItem[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = 20

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

const hasMore = computed(() => items.value.length < total.value)

async function load() {
  loading.value = true
  try {
    const offset = (page.value - 1) * pageSize
    const res = await listJudgements(pageSize, offset)
    items.value = res.items
    total.value = res.total
  } finally {
    loading.value = false
  }
}

function goDetail(item: JudgementListItem) {
  selectedId.value = item.id
  drawerVisible.value = true
}

function formatDate(d: string): string {
  const date = new Date(d)
  return date.toLocaleString('zh-CN', { hour12: false })
}

function onPageChange(p: number) {
  page.value = p
  load()
}

onMounted(load)
</script>

<template>
  <div class="judgement-list">
    <div class="header">
      <h1>答题记录</h1>
      <div class="summary">共 {{ total }} 条</div>
    </div>

    <div v-loading="loading">
      <el-empty v-if="!loading && items.length === 0" description="还没有答题记录" />

      <div v-else class="list">
        <el-card
          v-for="item in items"
          :key="item.id"
          class="item"
          shadow="hover"
          @click="goDetail(item)"
        >
          <div class="item-header">
            <div class="tags">
              <el-tag v-if="item.angle" size="small" type="info">
                {{ angleText[item.angle] ?? item.angle }}
              </el-tag>
              <el-tag v-if="item.intent" size="small" type="info" effect="plain">
                {{ intentText[item.intent] ?? item.intent }}
              </el-tag>
              <el-tag
                v-if="item.verdict"
                :type="verdictColor[item.verdict]"
                size="small"
              >
                {{ verdictText[item.verdict] }}
              </el-tag>
            </div>
            <div class="score">{{ item.score }} 分</div>
          </div>

          <div class="question">{{ item.questionPreview }}</div>

          <div class="meta">
            <span>{{ formatDate(item.judgedAt) }}</span>
            <span v-if="item.correctness !== null">
              正确性 {{ Math.round(item.correctness * 100) }}% ·
              完整性 {{ Math.round((item.completeness ?? 0) * 100) }}%
            </span>
          </div>
        </el-card>
      </div>

      <div v-if="hasMore && !loading" class="pagination">
        <el-pagination
          v-model:current-page="page"
          :page-size="pageSize"
          :total="total"
          layout="prev, pager, next"
          @current-change="onPageChange"
        />
      </div>
    </div>
          <JudgementDetailDrawer
        v-model="drawerVisible"
        :judgement-id="selectedId"
      />
  </div>
</template>

<style scoped lang="scss">
.judgement-list {
  max-width: 900px;
  margin: 0 auto;
  padding: 24px;
}
.header {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-bottom: 16px;
}
.header h1 {
  margin: 0;
}
.summary {
  color: #888;
  font-size: 14px;
}
.list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.item {
  cursor: pointer;
}
.item-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}
.tags {
  display: flex;
  gap: 6px;
}
.score {
  font-weight: 700;
  color: #444;
}
.question {
  font-size: 14px;
  color: #333;
  margin-bottom: 8px;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}
.meta {
  display: flex;
  gap: 12px;
  font-size: 12px;
  color: #888;
}
.pagination {
  margin-top: 16px;
  display: flex;
  justify-content: center;
}
</style>