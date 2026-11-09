<script setup lang="ts">
import { ref, watch, onMounted, onActivated } from 'vue'
import { ElMessage } from 'element-plus'
import { Search } from '@element-plus/icons-vue'
import {
  searchConcepts,
  generateQuestion,
  type ConceptItem,
  type QuestionAngle,
} from '@/api/concepts'
import {
  searchQuestions,
  type QuestionSearchItem,
} from '@/api/questions'
import ConceptTreeNav from './components/ConceptTreeNav.vue'

// ============================================================
// 常量
// ============================================================
const ANGLE_LABELS: Record<QuestionAngle, string> = {
  definition: '定义',
  application: '应用',
  contrast: '对比',
  'edge-case': '边界',
}

// ============================================================
// 状态
// ============================================================
const filters = ref({
  search: '',
  difficulty: null as string | null,
  showEmpty: false,
})

type SelectedNode = {
  type: 'topic' | 'document'
  id: string
  name: string
} | null

const selectedNode = ref<SelectedNode>(null)
const searchBackup = ref<SelectedNode>(null)
let resettingFromTree = false

const concepts = ref<ConceptItem[]>([])
const loading = ref(false)
const total = ref(0)
const totalQuestions = ref(0)
const page = ref(1)
const pageSize = ref(20)

const treeNavRef = ref<InstanceType<typeof ConceptTreeNav>>()

// ============================================================
// 加载
// ============================================================
async function load() {
  loading.value = true
  try {
    const params: any = {
      hasQuestions: !filters.value.showEmpty,
      page: page.value,
      pageSize: pageSize.value,
    }

    if (filters.value.search.trim()) {
      params.search = filters.value.search.trim()
    } else if (selectedNode.value) {
      if (selectedNode.value.type === 'topic') {
        params.topicId = selectedNode.value.id
      } else if (selectedNode.value.type === 'document') {
        params.docId = selectedNode.value.id
      }
    }

    if (filters.value.difficulty) {
      params.difficulty = filters.value.difficulty
    }

    const res = await searchConcepts(params)
    concepts.value = res.concepts
    total.value = res.total
    totalQuestions.value = res.totalQuestions
  } catch (err: any) {
    console.error('[QuestionList] load failed', err)
  } finally {
    loading.value = false
  }
}

// ============================================================
// 树选择
// ============================================================
function onTreeSelect(payload: SelectedNode) {
  selectedNode.value = payload
  searchBackup.value = null
  page.value = 1

  if (filters.value.search) {
    resettingFromTree = true
    filters.value.search = ''
  }

  load()
}

// ============================================================
// 搜索防抖
// ============================================================
let searchTimer: number
watch(
  () => filters.value.search,
  () => {
    if (resettingFromTree) {
      resettingFromTree = false
      return
    }

    clearTimeout(searchTimer)
    searchTimer = window.setTimeout(() => {
      if (filters.value.search.trim()) {
        if (selectedNode.value) {
          searchBackup.value = selectedNode.value
          selectedNode.value = null
        }
      } else {
        if (searchBackup.value) {
          selectedNode.value = searchBackup.value
          searchBackup.value = null
        }
      }
      page.value = 1
      load()
    }, 300)
  },
)

watch(
  () => filters.value.difficulty,
  () => {
    page.value = 1
    load()
  },
)

watch(
  () => filters.value.showEmpty,
  () => {
    page.value = 1
    load()
  },
)

// ============================================================
// Drawer
// ============================================================
const drawerVisible = ref(false)
const currentConcept = ref<ConceptItem | null>(null)
const conceptQuestions = ref<QuestionSearchItem[]>([])
const questionsLoading = ref(false)

interface AngleGroup {
  angle: QuestionAngle
  required: number
  generated: number
  questions: QuestionSearchItem[]
  isExtra: boolean
}

const angleGroups = ref<AngleGroup[]>([])

async function onOpenConcept(concept: ConceptItem) {
  currentConcept.value = concept
  drawerVisible.value = true
  questionsLoading.value = true

  try {
    const res = await searchQuestions({
      scope: 'all',
      conceptId: concept.id,
      page: 1,
      pageSize: 100,
    })
    conceptQuestions.value = res.questions

    const planGroups: AngleGroup[] = concept.plan.angles.map((angle) => ({
      angle,
      required: concept.plan.quota[angle] ?? 0,
      generated: concept.plan.generated[angle] ?? 0,
      questions: res.questions.filter(
        (q) => (q.angle ?? 'definition') === angle,
      ),
      isExtra: false,
    }))

    const extraAngles = Object.keys(concept.plan.generated).filter(
      (a) => !concept.plan.angles.includes(a as QuestionAngle),
    ) as QuestionAngle[]

    const extraGroups: AngleGroup[] = extraAngles.map((angle) => ({
      angle,
      required: 0,
      generated: concept.plan.generated[angle] ?? 0,
      questions: res.questions.filter(
        (q) => (q.angle ?? 'definition') === angle,
      ),
      isExtra: true,
    }))

    angleGroups.value = [...planGroups, ...extraGroups]
  } catch (err: any) {
    console.error('[QuestionList] load questions failed', err)
  } finally {
    questionsLoading.value = false
  }
}

// ============================================================
// ★ Drawer 内补题
// ============================================================
const generatingInDrawer = ref<Set<QuestionAngle>>(new Set())

async function onGenerateInDrawer(group: AngleGroup) {
  if (!currentConcept.value) return
  if (generatingInDrawer.value.has(group.angle)) return
  if (group.isExtra) return

  generatingInDrawer.value.add(group.angle)
  generatingInDrawer.value = new Set(generatingInDrawer.value)

  try {
    const res = await generateQuestion(currentConcept.value.id, group.angle, true)

    if (!res.question) {
      ElMessage.warning('出题失败，请重试')
      return
    }

    const newQuestion: QuestionSearchItem = {
      id: res.question.id,
      question: res.question.question,
      keyPoints: res.question.keyPoints ?? [],
      intent: res.question.intent,
      angle: res.question.angle,
      difficulty: res.question.difficulty,
      status: 'active',
      sourceDocId: currentConcept.value.docId,
      docTitle: currentConcept.value.docTitle,
      uploadedBy: null,
      conceptId: currentConcept.value.id,
      conceptName: currentConcept.value.canonicalName,
      judgementCount: 0,
      createdAt: new Date().toISOString(),
    }

    group.questions.push(newQuestion)
    group.generated += 1

    currentConcept.value.plan.generated[group.angle] = group.generated
    currentConcept.value.plan.totalGenerated += 1
    currentConcept.value.questionCount += 1

    // 同步更新列表里的 concept 卡片
    const idx = concepts.value.findIndex(
      (c) => c.id === currentConcept.value!.id,
    )
    if (idx !== -1) {
      concepts.value[idx].plan.generated[group.angle] = group.generated
      concepts.value[idx].plan.totalGenerated += 1
      concepts.value[idx].questionCount += 1
    }
    totalQuestions.value += 1

    ElMessage.success('已生成新题')
  } catch (err: any) {
    ElMessage.error(err.message ?? '出题失败')
  } finally {
    generatingInDrawer.value.delete(group.angle)
    generatingInDrawer.value = new Set(generatingInDrawer.value)
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
  if (!angle) return '-'
  return ANGLE_LABELS[angle as QuestionAngle] ?? angle
}

function angleStatus(concept: ConceptItem, angle: QuestionAngle) {
  const generated = concept.plan.generated[angle] ?? 0
  const required = concept.plan.quota[angle] ?? 0
  return {
    generated,
    required,
    isComplete: generated >= required && required > 0,
    isMissing: generated === 0,
    isPartial: generated > 0 && generated < required,
    text: `${generated}/${required}`,
  }
}

function overallProgress(concept: ConceptItem) {
  const generated = concept.plan.totalGenerated
  const required = concept.plan.totalRequired
  return {
    generated,
    required,
    percent: required > 0 ? Math.round((generated / required) * 100) : 0,
    isComplete: generated >= required && required > 0,
  }
}

function cardState(concept: ConceptItem): 'complete' | 'partial' | 'minimal' {
  const p = overallProgress(concept)
  if (p.isComplete) return 'complete'
  if (p.generated >= p.required / 2) return 'partial'
  return 'minimal'
}

function chipTooltip(concept: ConceptItem, angle: QuestionAngle): string {
  const s = angleStatus(concept, angle)
  if (s.isComplete) return `${angleLabel(angle)} 已完成`
  if (s.isMissing) return `${angleLabel(angle)} 未出题`
  return `${angleLabel(angle)} 还差 ${s.required - s.generated} 道`
}

// ============================================================
// 生命周期
// ============================================================
onMounted(load)
onActivated(load)

defineExpose({ refresh: load })
</script>

<template>
  <div class="question-list-view">
    <div class="layout">
      <ConceptTreeNav ref="treeNavRef" @select="onTreeSelect" />

      <div class="main">
        <div class="toolbar">
          <div class="toolbar-left">
            <h2 class="tab-title">
              题目
              <span v-if="selectedNode" class="selection-badge">
                · {{ selectedNode.name }}
              </span>
              <span
                v-else-if="filters.search.trim()"
                class="selection-badge search-mode"
              >
                · 搜索中
              </span>
            </h2>
            <span class="count">
              <strong class="count-primary">{{ totalQuestions }}</strong>
              <span class="count-unit">道题</span>
              <span class="count-secondary">（{{ total }} 个概念）</span>
            </span>
          </div>
        </div>

        <div class="filter-bar">
          <el-input
            v-model="filters.search"
            placeholder="搜索概念名（会清除左侧筛选）..."
            clearable
            style="width: 320px"
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

          <el-checkbox v-model="filters.showEmpty" class="show-empty-checkbox">
            显示未出题的概念
          </el-checkbox>
        </div>

        <div class="list-body" v-loading="loading">
          <div v-if="concepts.length > 0" class="concept-grid">
            <div
              v-for="concept in concepts"
              :key="concept.id"
              class="concept-card"
              :class="[
                `state-${cardState(concept)}`,
                { 'is-empty': concept.questionCount === 0 },
              ]"
              @click="onOpenConcept(concept)"
            >
              <div class="card-header">
                <h3 class="concept-name" :title="concept.canonicalName">
                  {{ concept.canonicalName }}
                </h3>
                <el-tag
                  :type="difficultyType(concept.difficulty)"
                  size="small"
                  effect="plain"
                  class="difficulty-tag"
                >
                  {{ difficultyLabel(concept.difficulty) }}
                </el-tag>
              </div>

              <div class="card-progress">
                <div class="progress-track">
                  <div
                    class="progress-fill"
                    :class="{ complete: overallProgress(concept).isComplete }"
                    :style="{ width: `${overallProgress(concept).percent}%` }"
                  />
                </div>
                <span
                  class="progress-num"
                  :class="{ complete: overallProgress(concept).isComplete }"
                >
                  {{ overallProgress(concept).generated }}/{{ overallProgress(concept).required }}
                </span>
              </div>

              <div class="angle-chips">
                <el-tooltip
                  v-for="angle in concept.plan.angles"
                  :key="angle"
                  :content="chipTooltip(concept, angle)"
                  placement="top"
                >
                  <span
                    class="angle-chip"
                    :class="{
                      'is-complete': angleStatus(concept, angle).isComplete,
                      'is-partial': angleStatus(concept, angle).isPartial,
                      'is-missing': angleStatus(concept, angle).isMissing,
                    }"
                  >
                    <span class="chip-label">{{ angleLabel(angle) }}</span>
                    <span class="chip-count">{{ angleStatus(concept, angle).text }}</span>
                  </span>
                </el-tooltip>
              </div>

              <div class="card-footer">
                <span class="footer-doc" :title="concept.docTitle ?? ''">
                  {{ concept.docTitle ?? '-' }}
                </span>
                <span class="footer-count">
                  <strong>{{ concept.questionCount }}</strong> 题
                </span>
              </div>
            </div>
          </div>

          <div v-else-if="!loading" class="empty-tip">
            <el-empty
              :description="
                selectedNode
                  ? '该维度下还没有概念'
                  : filters.search
                    ? '没有匹配的概念'
                    : filters.showEmpty
                      ? '还没有任何概念，去上传一份文档吧'
                      : '还没有出过题的概念，去出几道题吧'
              "
            />
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
      </div>
    </div>

    <el-drawer
      v-model="drawerVisible"
      :title="currentConcept?.canonicalName ?? '题目详情'"
      size="640px"
    >
      <div v-if="currentConcept" class="drawer-content">
        <div class="drawer-overview">
          <div class="overview-item">
            <span class="overview-label">来源文档</span>
            <span class="overview-value">{{ currentConcept.docTitle ?? '-' }}</span>
          </div>
          <div class="overview-item">
            <span class="overview-label">难度</span>
            <el-tag
              :type="difficultyType(currentConcept.difficulty)"
              size="small"
            >
              {{ difficultyLabel(currentConcept.difficulty) }}
            </el-tag>
          </div>
          <div class="overview-item">
            <span class="overview-label">总进度</span>
            <span
              class="overview-value progress"
              :class="{ complete: overallProgress(currentConcept).isComplete }"
            >
              {{ overallProgress(currentConcept).generated }}/{{ overallProgress(currentConcept).required }} 题
              （{{ overallProgress(currentConcept).percent }}%）
            </span>
          </div>
        </div>

        <div class="angle-groups" v-loading="questionsLoading">
          <div
            v-for="group in angleGroups"
            :key="group.angle"
            class="angle-group"
          >
            <div class="group-header">
              <span class="group-angle">
                {{ angleLabel(group.angle) }}
                <el-tag
                  v-if="group.isExtra"
                  size="small"
                  type="info"
                  effect="plain"
                  class="extra-tag"
                >
                  额外
                </el-tag>
              </span>
              <div class="group-header-right">
                <span
                  class="group-stat"
                  :class="{
                    complete:
                      group.isExtra ||
                      (group.generated >= group.required && group.required > 0),
                    missing: group.generated === 0,
                  }"
                >
                  {{
                    group.isExtra
                      ? `${group.generated} 道`
                      : `${group.generated}/${group.required}`
                  }}
                </span>

                <!-- ★ 补题按钮 -->
                <el-button
                  v-if="!group.isExtra && group.generated < group.required"
                  size="small"
                  type="primary"
                  plain
                  :loading="generatingInDrawer.has(group.angle)"
                  :disabled="generatingInDrawer.has(group.angle)"
                  @click="onGenerateInDrawer(group)"
                >
                  {{
                    generatingInDrawer.has(group.angle)
                      ? '出题中...'
                      : '+ 补 1 道'
                  }}
                </el-button>
              </div>
            </div>

            <div v-if="group.questions.length > 0" class="group-questions">
              <div
                v-for="(q, idx) in group.questions"
                :key="q.id"
                class="question-card"
              >
                <div class="q-header">
                  <span class="q-index">#{{ idx + 1 }}</span>
                  <span class="q-judgements">答过 {{ q.judgementCount }} 次</span>
                </div>
                <div class="q-text">{{ q.question }}</div>
                <div class="q-kps">
                  <div class="kps-label">评分要点（{{ q.keyPoints.length }}）</div>
                  <ul>
                    <li v-for="(kp, i) in q.keyPoints" :key="i">{{ kp }}</li>
                  </ul>
                </div>
              </div>
            </div>

            <div v-else class="group-empty">该角度还未出题</div>
          </div>
        </div>
      </div>
    </el-drawer>
  </div>
</template>

<style scoped lang="scss">
.question-list-view {
  height: 100%;
  background: #fafafa;
  overflow: hidden;
}

.layout {
  display: flex;
  height: 100%;
}

.main {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  overflow: hidden;
}

.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 24px 8px;
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
  color: #1f1f1f;
}

.selection-badge {
  font-weight: 400;
  font-size: 14px;
  color: #409eff;

  &.search-mode {
    color: #faad14;
  }
}

.count {
  font-size: 13px;
  color: #8c8c8c;
  display: inline-flex;
  align-items: baseline;
  gap: 2px;
}

.count-primary {
  font-size: 16px;
  font-weight: 600;
  color: #409eff;
  font-variant-numeric: tabular-nums;
  margin-right: 2px;
}

.count-unit {
  font-size: 13px;
  color: #8c8c8c;
}

.count-secondary {
  font-size: 13px;
  color: #8c8c8c;
  margin-left: 4px;
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

.show-empty-checkbox {
  margin-left: auto;
  font-size: 13px;
}

.list-body {
  flex: 1;
  overflow: auto;
  padding: 16px 24px;
}

.concept-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
  gap: 14px;
}

.concept-card {
  background: #fff;
  border: 1.5px solid #e5e5e5;
  border-radius: 10px;
  padding: 16px 18px;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  flex-direction: column;
  gap: 12px;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  }

  &.state-complete {
    border-color: #b7eb8f;
    background: linear-gradient(180deg, #fcfff9 0%, #fff 40%);
  }

  &.state-partial {
    border-color: #ffe58f;
    background: linear-gradient(180deg, #fffffa 0%, #fff 40%);
  }

  &.state-minimal {
    border-color: #ffccc7;
    background: linear-gradient(180deg, #fff9f8 0%, #fff 40%);
  }

  &.is-empty {
    border-style: dashed;
    opacity: 0.9;

    &:hover {
      opacity: 1;
      border-style: dashed;
    }
  }
}

.card-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
}

.concept-name {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: #1f1f1f;
  line-height: 1.4;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  flex: 1;
}

.difficulty-tag {
  flex-shrink: 0;
}

.card-progress {
  display: flex;
  align-items: center;
  gap: 10px;
}

.progress-track {
  flex: 1;
  height: 6px;
  background: #f0f0f0;
  border-radius: 3px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: #ffb84d;
  border-radius: 3px;
  transition: width 0.3s ease, background 0.2s;

  &.complete {
    background: #52c41a;
  }
}

.progress-num {
  font-size: 13px;
  font-weight: 600;
  color: #faad14;
  font-variant-numeric: tabular-nums;
  flex-shrink: 0;
  min-width: 36px;
  text-align: right;

  &.complete {
    color: #52c41a;
  }
}

.angle-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.angle-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 8px;
  border-radius: 4px;
  font-size: 12px;
  border: 1px solid transparent;
  transition: all 0.2s;

  .chip-label {
    color: inherit;
  }

  .chip-count {
    font-variant-numeric: tabular-nums;
    font-weight: 600;
    color: inherit;
    opacity: 0.75;
  }

  &.is-complete {
    background: #f6ffed;
    border-color: #b7eb8f;
    color: #52c41a;

    .chip-count {
      opacity: 1;
    }
  }

  &.is-partial {
    background: #fffbe6;
    border-color: #ffe58f;
    color: #faad14;

    .chip-count {
      opacity: 1;
    }
  }

  &.is-missing {
    background: #fff1f0;
    border-color: #ffccc7;
    color: #ff4d4f;

    .chip-count {
      opacity: 1;
    }
  }
}

.card-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
  padding-top: 10px;
  border-top: 1px solid #f0f0f0;
  margin-top: auto;
}

.footer-doc {
  color: #8c8c8c;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
  margin-right: 12px;
}

.footer-count {
  color: #595959;
  flex-shrink: 0;

  strong {
    color: #409eff;
    font-size: 13px;
    margin-right: 2px;
  }
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

.drawer-content {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.drawer-overview {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 16px;
  background: #fafafa;
  border-radius: 6px;
}

.overview-item {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 13px;
}

.overview-label {
  color: #8c8c8c;
  min-width: 72px;
}

.overview-value {
  color: #1f1f1f;

  &.progress {
    font-weight: 600;
    color: #faad14;

    &.complete {
      color: #52c41a;
    }
  }
}

.angle-groups {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.angle-group {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.group-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: 8px;
  border-bottom: 2px solid #f0f0f0;
}

.group-angle {
  display: inline-flex;
  align-items: center;
  font-size: 14px;
  font-weight: 600;
  color: #1f1f1f;
}

.group-header-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.extra-tag {
  margin-left: 6px;
  font-weight: 400;
  transform: scale(0.9);
  transform-origin: left center;
}

.group-stat {
  font-size: 13px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  color: #ff4d4f;

  &.complete {
    color: #52c41a;
  }

  &.missing {
    color: #ff4d4f;
  }
}

.group-questions {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.question-card {
  background: #fff;
  border: 1px solid #e5e5e5;
  border-radius: 6px;
  padding: 14px 16px;
}

.q-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.q-index {
  font-size: 12px;
  color: #409eff;
  font-weight: 600;
}

.q-judgements {
  font-size: 12px;
  color: #8c8c8c;
}

.q-text {
  font-size: 14px;
  line-height: 1.6;
  color: #1f1f1f;
  margin-bottom: 12px;
}

.q-kps {
  padding-top: 12px;
  border-top: 1px dashed #e5e5e5;
}

.kps-label {
  font-size: 12px;
  font-weight: 500;
  color: #8c8c8c;
  margin-bottom: 8px;
}

.q-kps ul {
  margin: 0;
  padding-left: 20px;
  font-size: 13px;
  color: #595959;
  line-height: 1.6;
}

.q-kps li {
  margin-bottom: 4px;
}

.group-empty {
  padding: 20px;
  text-align: center;
  font-size: 13px;
  color: #bfbfbf;
  background: #fafafa;
  border-radius: 6px;
  border: 1px dashed #e5e5e5;
}
</style>