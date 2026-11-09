<script setup lang="ts">
import { ref, computed, watch, onMounted, onActivated } from 'vue'
import { ElMessage } from 'element-plus'
import { Search, Plus } from '@element-plus/icons-vue'
import {
  searchConcepts,
  generateQuestion,
  type ConceptItem,
  type QuestionAngle,
} from '@/api/concepts'
import { searchQuestions, type QuestionSearchItem } from '@/api/questions'

// ============================================================
// 状态
// ============================================================
const filters = ref({
  search: '',
  difficulty: null as string | null,
  hasQuestions: false,
})

const concepts = ref<ConceptItem[]>([])
const loading = ref(false)
const total = ref(0)
const page = ref(1)
const pageSize = ref(20)

const generating = ref<Set<string>>(new Set())

// ============================================================
// 加载
// ============================================================
async function load() {
  loading.value = true
  try {
    const res = await searchConcepts({
      ...filters.value,
      page: page.value,
      pageSize: pageSize.value,
    })
    concepts.value = res.concepts
    total.value = res.total
  } catch (err: any) {
    ElMessage.error(err.message ?? '加载概念失败')
  } finally {
    loading.value = false
  }
}

// 搜索防抖
let searchTimer: number
watch(
  () => filters.value.search,
  () => {
    clearTimeout(searchTimer)
    searchTimer = window.setTimeout(() => {
      page.value = 1
      load()
    }, 300)
  },
)

watch([() => filters.value.difficulty, () => filters.value.hasQuestions], () => {
  page.value = 1
  load()
})

// ============================================================
// 出题
// ============================================================
async function onGenerate(concept: ConceptItem) {
  if (generating.value.has(concept.id)) return

  generating.value.add(concept.id)
  generating.value = new Set(generating.value)

  try {
    const res = await generateQuestion(concept.id)
    if (!res.question) {
      ElMessage.warning('出题失败，请重试')
      return
    }
    ElMessage.success(
      `已生成：${res.question.question?.slice(0, 20) ?? ''}...`,
    )
    // 局部更新：刷新这一条的 plan.generated 和 questionCount
    const idx = concepts.value.findIndex((c) => c.id === concept.id)
    if (idx !== -1) {
      const angle = (res.question.angle ?? 'definition') as QuestionAngle
      const current = concepts.value[idx]
      current.questionCount += 1
      current.plan.generated[angle] = (current.plan.generated[angle] ?? 0) + 1
      current.plan.totalGenerated += 1
    }
  } catch (err: any) {
    ElMessage.error(err.message ?? '出题失败')
  } finally {
    generating.value.delete(concept.id)
    generating.value = new Set(generating.value)
  }
}

// ============================================================
// 抽屉：查看某 concept 的题
// ============================================================
const drawerVisible = ref(false)
const currentConcept = ref<ConceptItem | null>(null)
const conceptQuestions = ref<QuestionSearchItem[]>([])
const questionsLoading = ref(false)

async function onViewQuestions(concept: ConceptItem) {
  currentConcept.value = concept
  drawerVisible.value = true
  questionsLoading.value = true
  try {
    const res = await searchQuestions({
      scope: 'all',
      conceptId: concept.id,
      page: 1,
      pageSize: 50,
    })
    conceptQuestions.value = res.questions
  } catch (err: any) {
    ElMessage.error(err.message ?? '加载题目失败')
  } finally {
    questionsLoading.value = false
  }
}

// ============================================================
// 工具
// ============================================================
function difficultyLabel(d: number): string {
  if (d < 0.4) return '简单'
  if (d < 0.7) return '中等'
  return '困难'
}

function difficultyType(d: number): 'success' | 'warning' | 'danger' {
  if (d < 0.4) return 'success'
  if (d < 0.7) return 'warning'
  return 'danger'
}

function angleLabel(angle: string | null): string {
  const map: Record<string, string> = {
    definition: '定义',
    application: '应用',
    contrast: '对比',
    'edge-case': '边界',
  }
  return angle ? (map[angle] ?? angle) : '-'
}

/**
 * 算「下一道该出什么 angle」（用于按钮文案）
 * 与后端 computeConceptPlan 的逻辑一致
 */
function nextAngle(concept: ConceptItem): QuestionAngle | null {
  for (const angle of concept.plan.angles) {
    const generated = concept.plan.generated[angle] ?? 0
    const required = concept.plan.quota[angle] ?? 0
    if (generated < required) return angle
  }
  return null
}

function generateButtonText(concept: ConceptItem): string {
  if (generating.value.has(concept.id)) return '生成中...'
  const angle = nextAngle(concept)
  if (!angle) return '补充应用题'
  return `生成${angleLabel(angle)}题`
}

function progressText(concept: ConceptItem): string {
  return `${concept.plan.totalGenerated}/${concept.plan.totalRequired}`
}

// ============================================================
// 生命周期
// ============================================================
onMounted(load)
onActivated(load)

defineExpose({ refresh: load })
</script>

<template>
  <div class="concept-list-view">
    <!-- 工具栏 -->
    <div class="toolbar">
      <div class="toolbar-left">
        <h2 class="tab-title">概念</h2>
        <span class="count">{{ total }} 个概念</span>
      </div>
    </div>

    <!-- 筛选栏 -->
    <div class="filter-bar">
      <el-input
        v-model="filters.search"
        placeholder="搜索概念名或定义..."
        clearable
        style="width: 280px"
      >
        <template #prefix>
          <el-icon><Search /></el-icon>
        </template>
      </el-input>

      <el-select
        v-model="filters.difficulty"
        placeholder="难度"
        clearable
        style="width: 110px"
      >
        <el-option label="简单" value="easy" />
        <el-option label="中等" value="medium" />
        <el-option label="困难" value="hard" />
      </el-select>

      <el-checkbox v-model="filters.hasQuestions" label="只看有题的" />
    </div>

    <!-- 列表 -->
    <div class="list-body" v-loading="loading">
      <el-table
        v-if="concepts.length > 0"
        :data="concepts"
        stripe
        row-key="id"
        class="concept-table"
      >
        <el-table-column label="概念名" min-width="200">
          <template #default="{ row }">
            <div class="concept-name">{{ row.canonicalName }}</div>
            <div class="concept-def">{{ row.definition }}</div>
          </template>
        </el-table-column>

        <el-table-column prop="docTitle" label="来源文档" width="160">
          <template #default="{ row }">
            <span v-if="row.docTitle" class="doc-text" :title="row.docTitle">
              {{ row.docTitle }}
            </span>
            <span v-else class="muted">-</span>
          </template>
        </el-table-column>

        <el-table-column label="难度" width="90" align="center">
          <template #default="{ row }">
            <el-tag :type="difficultyType(row.difficulty)" size="small">
              {{ difficultyLabel(row.difficulty) }}
            </el-tag>
          </template>
        </el-table-column>

        <!-- ★ 进度列 -->
        <el-table-column label="进度" width="100" align="center">
          <template #default="{ row }">
            <span
              class="progress-text"
              :class="{
                'is-complete': row.plan.totalGenerated >= row.plan.totalRequired,
              }"
            >
              {{ progressText(row) }}
            </span>
          </template>
        </el-table-column>

        <el-table-column label="题数" width="90" align="center">
          <template #default="{ row }">
            <span :class="{ 'has-questions': row.questionCount > 0 }">
              {{ row.questionCount }}
            </span>
          </template>
        </el-table-column>

        <el-table-column label="操作" width="240" fixed="right">
          <template #default="{ row }">
            <el-button
              size="small"
              type="primary"
              :icon="Plus"
              :loading="generating.has(row.id)"
              :disabled="generating.has(row.id)"
              @click="onGenerate(row)"
            >
              {{ generateButtonText(row) }}
            </el-button>

            <el-button
              v-if="row.questionCount > 0"
              size="small"
              link
              @click="onViewQuestions(row)"
            >
              查看题目
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <div v-else-if="!loading" class="empty-tip">
        <el-empty description="还没有概念，请先上传文档" />
      </div>

      <el-pagination
        v-if="total > pageSize"
        v-model:current-page="page"
        :page-size="pageSize"
        :total="total"
        layout="total, prev, pager, next"
        class="pagination"
        @current-change="load"
      />
    </div>

    <!-- 抽屉：某 concept 的题 -->
    <el-drawer
      v-model="drawerVisible"
      :title="`「${currentConcept?.canonicalName ?? ''}」的题目`"
      size="560px"
    >
      <div v-loading="questionsLoading" class="question-list">
        <div
          v-for="q in conceptQuestions"
          :key="q.id"
          class="question-card"
        >
          <div class="question-header">
            <el-tag size="small" effect="plain">{{ angleLabel(q.angle) }}</el-tag>
            <el-tag size="small">{{ q.difficulty }}</el-tag>
            <span class="judgement-count">答过 {{ q.judgementCount }} 次</span>
          </div>
          <div class="question-text">{{ q.question }}</div>
          <div class="question-kps">
            <div class="kps-label">评分要点：</div>
            <ul>
              <li v-for="(kp, i) in q.keyPoints" :key="i">{{ kp }}</li>
            </ul>
          </div>
        </div>

        <el-empty
          v-if="!questionsLoading && conceptQuestions.length === 0"
          description="暂无题目"
        />
      </div>
    </el-drawer>
  </div>
</template>

<style scoped lang="scss">
.concept-list-view {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #fafafa;
}

.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 24px;
  background: #fff;
  border-bottom: 1px solid #f0f0f0;
  flex-shrink: 0;
}

.toolbar-left {
  display: flex;
  align-items: baseline;
  gap: 12px;
}

.tab-title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
}

.count {
  font-size: 13px;
  color: #8c8c8c;
}

.filter-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 24px;
  background: #fff;
  border-bottom: 1px solid #f0f0f0;
  flex-shrink: 0;
}

.list-body {
  flex: 1;
  overflow: auto;
  padding: 16px 24px;
}

.concept-table {
  background: #fff;
  border-radius: 6px;
  overflow: hidden;
}

.concept-name {
  font-size: 14px;
  font-weight: 500;
  color: #1f1f1f;
  margin-bottom: 2px;
}

.concept-def {
  font-size: 12px;
  color: #8c8c8c;
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 1;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.doc-text {
  font-size: 13px;
  color: #595959;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  display: block;
}

.muted {
  color: #c0c4cc;
}

.progress-text {
  font-variant-numeric: tabular-nums;
  font-weight: 500;
  color: #8c8c8c;

  &.is-complete {
    color: #52c41a;
  }
}

.has-questions {
  color: #409eff;
  font-weight: 500;
}

.empty-tip {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 300px;
}

.pagination {
  margin-top: 16px;
  display: flex;
  justify-content: flex-end;
}

/* 抽屉 */
.question-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.question-card {
  padding: 16px;
  background: #fff;
  border: 1px solid #e5e5e5;
  border-radius: 6px;
}

.question-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}

.judgement-count {
  font-size: 12px;
  color: #8c8c8c;
  margin-left: auto;
}

.question-text {
  font-size: 14px;
  font-weight: 500;
  color: #1f1f1f;
  margin-bottom: 12px;
  line-height: 1.6;
}

.question-kps {
  font-size: 13px;
  color: #595959;
}

.kps-label {
  font-weight: 500;
  color: #8c8c8c;
  margin-bottom: 6px;
}

.question-kps ul {
  margin: 0;
  padding-left: 20px;
}

.question-kps li {
  line-height: 1.6;
  margin-bottom: 4px;
}
</style>