<script setup lang="ts">
import { onMounted, onUnmounted, ref, computed } from 'vue'
import {
  fetchAllMastery,
  type MasteryItem,
  type MasteryStatus,
  type Verdict,
} from '@/api/mastery'
import MasteryDetailDrawer from './MasteryDetailDrawer.vue'

// ============================================================
// 状态
// ============================================================
const loading = ref(true)
const list = ref<MasteryItem[]>([])
const activeTab = ref<'all' | MasteryStatus>('all')

// 抽屉
const drawerVisible = ref(false)
const selectedItem = ref<MasteryItem | null>(null)
const drawerSize = ref('420px')

function openDetail(item: MasteryItem) {
  selectedItem.value = item
  drawerVisible.value = true
}

function updateDrawerSize() {
  drawerSize.value = window.innerWidth < 768 ? '90%' : '420px'
}

// ============================================================
// 状态归一化（后端 bug 兜底）
// 有些概念 totalAttempts > 0 但 status 仍是 not-started，
// 这里统一按 learning 处理，保证 Tab / 计数 / tag 一致
// ============================================================
function normalizedStatus(item: MasteryItem): MasteryStatus {
  if (item.status === 'not-started' && item.totalAttempts > 0) return 'learning'
  return item.status
}

// ============================================================
// 总览数据
// ============================================================
const practicedCount = computed(() => list.value.length)

const avgMastery = computed(() => {
  if (list.value.length === 0) return 0
  const sum = list.value.reduce((s, i) => s + i.masteryScore, 0)
  return Math.round((sum / list.value.length) * 100)
})

const statusCounts = computed(() => {
  const counts: Record<MasteryStatus, number> = {
    'not-started': 0,
    learning: 0,
    proficient: 0,
    mastered: 0,
  }
  for (const item of list.value) counts[normalizedStatus(item)]++
  return counts
})

const statusItems = computed(() => [
  { key: 'learning' as const, label: '学习中', color: '#ff9f1c', count: statusCounts.value.learning },
  { key: 'proficient' as const, label: '较熟练', color: '#1890ff', count: statusCounts.value.proficient },
  { key: 'mastered' as const, label: '已掌握', color: '#10b981', count: statusCounts.value.mastered },
])

const weakestItems = computed(() =>
  list.value
    .filter((i) => normalizedStatus(i) !== 'mastered')
    .slice(0, 3)
    .map((i) => i.conceptName ?? i.conceptId),
)

// ============================================================
// Tab 数据
// ============================================================
const tabItems = computed(() => [
  { key: 'all' as const, label: '全部', count: list.value.length },
  { key: 'not-started' as const, label: '未开始', count: statusCounts.value['not-started'] },
  { key: 'learning' as const, label: '学习中', count: statusCounts.value.learning },
  { key: 'proficient' as const, label: '较熟练', count: statusCounts.value.proficient },
  { key: 'mastered' as const, label: '已掌握', count: statusCounts.value.mastered },
])

const filtered = computed(() => {
  if (activeTab.value === 'all') return list.value
  return list.value.filter((i) => normalizedStatus(i) === activeTab.value)
})

const currentTabLabel = computed(
  () => tabItems.value.find((t) => t.key === activeTab.value)?.label ?? '',
)

// ============================================================
// 状态映射
// ============================================================
const statusText: Record<MasteryStatus, string> = {
  'not-started': '未开始',
  learning: '学习中',
  proficient: '较熟练',
  mastered: '已掌握',
}

const statusType: Record<MasteryStatus, 'info' | 'warning' | 'primary' | 'success'> = {
  'not-started': 'info',
  learning: 'warning',
  proficient: 'primary',
  mastered: 'success',
}

const verdictText: Record<Verdict, string> = {
  correct: '答对',
  partial: '部分对',
  wrong: '答错',
  missing: '未答',
}

function progressColor(score: number): string {
  if (score >= 0.8) return '#10b981'
  if (score >= 0.55) return '#1890ff'
  if (score >= 0.3) return '#ff9f1c'
  return '#f5222d'
}

// ============================================================
// 加载（兼容多种返回结构）
// ============================================================
async function load() {
  loading.value = true
  try {
    const res: any = await fetchAllMastery()

    // 兼容：数组 / {items} / {data:{items}} / {data}
    let raw: MasteryItem[] = []
    if (Array.isArray(res)) raw = res
    else if (res && Array.isArray(res.items)) raw = res.items
    else if (res && Array.isArray(res.data?.items)) raw = res.data.items
    else if (res && Array.isArray(res.data)) raw = res.data

    console.log(
      '[mastery] load',
      'type=', Object.prototype.toString.call(res),
      'keys=', res && typeof res === 'object' ? Object.keys(res) : '-',
      'count=', raw.length,
    )

    list.value = raw.slice().sort((a, b) => a.masteryScore - b.masteryScore)
  } catch (err) {
    console.error('[mastery] load failed:', err)
    list.value = []
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  load()
  updateDrawerSize()
  window.addEventListener('resize', updateDrawerSize)
})

onUnmounted(() => {
  window.removeEventListener('resize', updateDrawerSize)
})

function formatDate(d: string | null): string {
  if (!d) return '未答过'
  const date = new Date(d)
  const diff = Date.now() - date.getTime()
  const minute = Math.floor(diff / 60000)
  const day = Math.floor(diff / 86400000)
  if (minute < 1) return '刚刚'
  if (minute < 60) return `${minute} 分钟前`
  if (day === 0) return '今天'
  if (day === 1) return '昨天'
  if (day < 7) return `${day} 天前`
  return date.toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' })
}
</script>

<template>
  <div class="mastery-page" v-loading="loading">
    <!-- ============================================================ -->
    <!-- 总览 -->
    <!-- ============================================================ -->
    <div class="overview-card">
      <div class="overview-head">
        <h1>我的掌握度</h1>
        <div class="overview-actions">
          <el-button text @click="load">
            <span class="refresh-icon">↻</span> 刷新
          </el-button>
          <el-button text type="primary" @click="$router.push('/chat/topic-practice')">
            去练习 →
          </el-button>
        </div>
      </div>

      <div class="overview-stats">
        <div class="stat-block">
          <div class="stat-value">{{ practicedCount }}</div>
          <div class="stat-label">已练概念</div>
        </div>
        <div class="stat-divider" />
        <div class="stat-block">
          <div class="stat-value">
            {{ avgMastery }}<span class="stat-unit">%</span>
          </div>
          <div class="stat-label">平均掌握度</div>
        </div>
        <div class="stat-divider" />
        <div class="status-bar">
          <div v-for="s in statusItems" :key="s.key" class="status-bar-item">
            <span class="dot" :style="{ background: s.color }" />
            <span class="status-label">{{ s.label }}</span>
            <span class="status-count">{{ s.count }}</span>
          </div>
        </div>
      </div>

      <div v-if="weakestItems.length > 0" class="weakest-hint">
        <span class="hint-icon">💡</span>
        <span>
          <strong>优先复习：</strong>
          {{ weakestItems.join(' · ') }}
        </span>
      </div>
    </div>

    <!-- ============================================================ -->
    <!-- 空状态（无任何数据） -->
    <!-- ============================================================ -->
    <el-empty
      v-if="!loading && list.length === 0"
      description="还没有练习记录，去主题练习试试吧"
    >
      <el-button type="primary" @click="$router.push('/practice')">
        去练习
      </el-button>
    </el-empty>

    <!-- ============================================================ -->
    <!-- Tab（按钮组，不是 el-tabs）+ 卡片列表 -->
    <!-- ============================================================ -->
    <template v-else>
      <div class="tabs">
        <button
          v-for="tab in tabItems"
          :key="tab.key"
          type="button"
          class="tab"
          :class="{ 'is-active': activeTab === tab.key }"
          @click="activeTab = tab.key"
        >
          {{ tab.label }}
          <span class="tab-count" :class="{ 'is-zero': tab.count === 0 }">
            {{ tab.count }}
          </span>
        </button>
      </div>

      <el-empty
        v-if="filtered.length === 0"
        :description="`暂无「${currentTabLabel}」的概念`"
        :image-size="80"
      />

      <div v-else class="card-list">
        <el-card
          v-for="item in filtered"
          :key="item.conceptId"
          class="card"
          shadow="hover"
          @click="openDetail(item)"
        >
          <div class="card-header">
            <div class="card-name">
              {{ item.conceptName ?? item.conceptId }}
              <el-tag v-if="item.domain" size="small" type="info" effect="plain">
                {{ item.domain }}
              </el-tag>
            </div>
            <el-tag :type="statusType[normalizedStatus(item)]" size="small">
              {{ statusText[normalizedStatus(item)] }}
            </el-tag>
          </div>

          <div class="card-progress">
            <div class="progress-label">
              <span>掌握度</span>
              <span class="progress-value">
                {{ Math.round(item.masteryScore * 100) }}%
              </span>
            </div>
            <el-progress
              :percentage="Math.round(item.masteryScore * 100)"
              :color="progressColor(item.masteryScore)"
              :show-text="false"
              :stroke-width="6"
            />
          </div>

          <div class="card-meta">
            <span>答对 {{ item.correctAttempts }}/{{ item.totalAttempts }}</span>
            <span v-if="item.lastVerdict">最近 {{ verdictText[item.lastVerdict] }}</span>
            <span class="meta-date">{{ formatDate(item.lastAttemptAt) }}</span>
          </div>
        </el-card>
      </div>
    </template>

    <!-- ============================================================ -->
    <!-- 详情抽屉 -->
    <!-- ============================================================ -->
    <el-drawer
      v-model="drawerVisible"
      :title="selectedItem?.conceptName ?? '概念详情'"
      direction="rtl"
      :size="drawerSize"
    >
      <MasteryDetailDrawer
        :concept-id="selectedItem?.conceptId ?? null"
        :concept-name="selectedItem?.conceptName"
      />
    </el-drawer>
  </div>
</template>

<style scoped lang="scss">
.mastery-page {
  position: absolute;
  inset: 0;
  overflow-y: auto;
  overflow-x: hidden;
  -webkit-overflow-scrolling: touch;
  box-sizing: border-box;
  padding: 24px;
}

.mastery-page > * {
  max-width: 1100px;
  margin-left: auto;
  margin-right: auto;
}

/* ============================================================ */
/* 总览卡片 */
/* ============================================================ */
.overview-card {
  background: #fff;
  border-radius: 12px;
  padding: 20px 28px 24px;
  margin-bottom: 24px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
  border: 1px solid #f0f0f0;
}

.overview-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}
.overview-head h1 {
  margin: 0;
  font-size: 22px;
  font-weight: 600;
  color: #262626;
}
.overview-actions {
  display: flex;
  gap: 4px;
  align-items: center;
}
.refresh-icon {
  display: inline-block;
  margin-right: 2px;
}

.overview-stats {
  display: flex;
  align-items: center;
  gap: 24px;
  flex-wrap: wrap;
}

.stat-block {
  text-align: center;
}
.stat-value {
  font-size: 32px;
  font-weight: 700;
  color: #262626;
  line-height: 1.1;
  font-variant-numeric: tabular-nums;
}
.stat-unit {
  font-size: 18px;
  font-weight: 500;
  margin-left: 2px;
  color: #8c8c8c;
}
.stat-label {
  font-size: 12px;
  color: #888;
  margin-top: 4px;
}

.stat-divider {
  width: 1px;
  height: 40px;
  background: #f0f0f0;
}

.status-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 16px 20px;
  align-items: center;
}
.status-bar-item {
  display: flex;
  align-items: center;
  gap: 6px;
}
.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}
.status-label {
  font-size: 13px;
  color: #595959;
}
.status-count {
  font-size: 13px;
  font-weight: 600;
  color: #262626;
  min-width: 20px;
  font-variant-numeric: tabular-nums;
}

.weakest-hint {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin-top: 20px;
  padding: 10px 14px;
  background: #fffbe6;
  border-left: 3px solid #faad14;
  border-radius: 6px;
  font-size: 13px;
  color: #8c6d1f;
  line-height: 1.6;
}
.hint-icon {
  line-height: 1.6;
  flex-shrink: 0;
}

/* ============================================================ */
/* Tab（按钮组） */
/* ============================================================ */
.tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-bottom: 16px;
  border-bottom: 1px solid #f0f0f0;
}
.tab {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 10px 14px;
  border: none;
  background: transparent;
  font-size: 14px;
  font-weight: 500;
  color: #595959;
  cursor: pointer;
  border-bottom: 2px solid transparent;
  margin-bottom: -1px;
  transition: color 0.15s, border-color 0.15s;
}
.tab:hover {
  color: #1890ff;
}
.tab.is-active {
  color: #1890ff;
  border-bottom-color: #1890ff;
}

.tab-count {
  display: inline-block;
  padding: 0 6px;
  height: 16px;
  line-height: 16px;
  border-radius: 8px;
  background: #f0f0f0;
  font-size: 11px;
  color: #666;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
}
.tab-count.is-zero {
  opacity: 0.45;
}
.tab.is-active .tab-count {
  background: #e6f4ff;
  color: #1890ff;
  opacity: 1;
}

/* ============================================================ */
/* 卡片 */
/* ============================================================ */
.card-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 12px;
}

.card {
  cursor: pointer;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}
.card:hover {
  transform: translateY(-2px);
}
.card :deep(.el-card__body) {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
}
.card-name {
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  color: #262626;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.card-progress {
  margin: 4px 0 12px;
}
.progress-label {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  color: #888;
  margin-bottom: 6px;
}
.progress-value {
  font-weight: 600;
  color: #262626;
  font-variant-numeric: tabular-nums;
}

.card-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 12px;
  font-size: 12px;
  color: #888;
  margin-top: auto;
}
.meta-date {
  margin-left: auto;
  color: #bfbfbf;
}
</style>