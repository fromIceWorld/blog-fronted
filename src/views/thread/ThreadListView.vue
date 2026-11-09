<script setup lang="ts">
import { ref, watch, onMounted, onActivated } from 'vue'
import {
  listThreads,
  type ThreadListItem,
} from '@/api/threads'
import ThreadDetailDrawer from './ThreadDetailDrawer.vue'

// ============================================================
// 状态
// ============================================================
const filters = ref({
  status: null as string | null,
})

const threads = ref<ThreadListItem[]>([])
const loading = ref(false)
const total = ref(0)
const page = ref(1)
const pageSize = ref(20)

const drawerVisible = ref(false)
const currentThreadId = ref<string | null>(null)

// ============================================================
// 加载
// ============================================================
async function load() {
  loading.value = true
  try {
    const res = await listThreads({
      limit: pageSize.value,
      offset: (page.value - 1) * pageSize.value,
      status: filters.value.status || undefined,
    })
    threads.value = res.items
    total.value = res.total
  } catch (err: any) {
    console.error('[ThreadList] load failed', err)
  } finally {
    loading.value = false
  }
}

watch(
  () => filters.value.status,
  () => {
    page.value = 1
    load()
  },
)

function onPageChange(p: number) {
  page.value = p
  load()
}

function onRowClick(row: ThreadListItem) {
  currentThreadId.value = row.threadId
  drawerVisible.value = true
}

// ============================================================
// 工具
// ============================================================
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
  return new Date(d).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function statusLabel(s: string): string {
  const map: Record<string, string> = {
    active: '进行中',
    completed: '已完成',
    abandoned: '已放弃',
  }
  return map[s] ?? s
}

function statusType(s: string): 'success' | 'info' | 'warning' {
  if (s === 'completed') return 'success'
  if (s === 'active') return 'info'
  return 'warning'
}

// ============================================================
// 生命周期
// ============================================================
onMounted(load)
onActivated(load)

defineExpose({ refresh: load })
</script>

<template>
  <div class="thread-list-view">
    <!-- 工具栏 -->
    <div class="toolbar">
      <div class="toolbar-left">
        <h2 class="tab-title">答题记录</h2>
        <span class="count">{{ total }} 条</span>
      </div>
      <div class="toolbar-right">
        <el-select
          v-model="filters.status"
          placeholder="状态"
          clearable
          style="width: 130px"
        >
          <el-option label="全部" :value="null" />
          <el-option label="已完成" value="completed" />
          <el-option label="进行中" value="active" />
          <el-option label="已放弃" value="abandoned" />
        </el-select>
      </div>
    </div>

    <!-- 列表 -->
    <div class="list-body" v-loading="loading">
      <div v-if="threads.length > 0" class="thread-cards">
        <div
          v-for="t in threads"
          :key="t.threadId"
          class="thread-card"
          :class="`status-${t.status}`"
          @click="onRowClick(t)"
        >
          <!-- 头部：概念 + 状态 -->
          <div class="card-header">
            <div class="header-left">
              <span class="concept-name">{{ t.conceptName }}</span>
              <el-tag size="small" effect="plain">
                {{ angleLabel(t.originalAngle) }}
              </el-tag>
            </div>
            <el-tag :type="statusType(t.status)" size="small">
              {{ statusLabel(t.status) }}
            </el-tag>
          </div>

          <!-- 原题预览 -->
          <div class="question-preview">{{ t.originalQuestionPreview }}</div>

          <!-- 判分链路 -->
          <div class="verdict-row">
            <!-- 原题判分 -->
            <div class="verdict-block">
              <span class="verdict-label">原题</span>
              <el-tag
                :type="verdictType(t.originalVerdict)"
                size="small"
                effect="plain"
              >
                {{ verdictLabel(t.originalVerdict) }}
              </el-tag>
            </div>

            <!-- 追问 -->
            <template v-if="t.retryRounds > 0">
              <span class="arrow">→</span>
              <div class="verdict-block">
                <span class="verdict-label">追问 {{ t.retryRounds }} 次</span>
                <el-tag
                  :type="verdictType(t.finalVerdict)"
                  size="small"
                >
                  {{ verdictLabel(t.finalVerdict) }}
                </el-tag>
              </div>
            </template>

            <!-- 讨论 -->
            <template v-if="t.discussionRounds > 0">
              <span class="arrow">→</span>
              <div class="verdict-block">
                <span class="verdict-label">讨论 {{ t.discussionRounds }} 轮</span>
                <el-tag
                  v-if="t.hadDiscussionRevision"
                  type="warning"
                  size="small"
                >
                  改判
                </el-tag>
              </div>
            </template>
          </div>

          <!-- 底部：时间 + mastery -->
          <div class="card-footer">
            <span class="time">{{ formatDate(t.startedAt) }}</span>
            <span v-if="t.masteryWeight != null" class="mastery">
              掌握度 {{ t.masteryWeight.toFixed(2) }}
            </span>
          </div>
        </div>
      </div>

      <el-empty v-else-if="!loading" description="还没有答题记录" />

      <el-pagination
        v-if="total > pageSize"
        v-model:current-page="page"
        :page-size="pageSize"
        :total="total"
        layout="total, prev, pager, next"
        class="pagination"
        @current-change="onPageChange"
      />
    </div>

    <!-- 详情抽屉 -->
    <ThreadDetailDrawer
      v-model:visible="drawerVisible"
      :thread-id="currentThreadId"
    />
  </div>
</template>

<style scoped lang="scss">
.thread-list-view {
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

.list-body {
  flex: 1;
  overflow: auto;
  padding: 16px 24px;
}

.thread-cards {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.thread-card {
  background: #fff;
  border: 1px solid #e5e5e5;
  border-radius: 8px;
  padding: 16px 20px;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  flex-direction: column;
  gap: 10px;

  &:hover {
    border-color: #409eff;
    box-shadow: 0 2px 8px rgba(64, 158, 255, 0.1);
    transform: translateY(-1px);
  }

  &.status-active {
    border-left: 3px solid #409eff;
  }
  &.status-abandoned {
    opacity: 0.7;
    border-left: 3px solid #faad14;
  }
  &.status-completed {
    border-left: 3px solid #52c41a;
  }
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.concept-name {
  font-size: 15px;
  font-weight: 600;
  color: #1f1f1f;
}

.question-preview {
  font-size: 13px;
  color: #595959;
  line-height: 1.5;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.verdict-row {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  padding: 8px 0;
  border-top: 1px dashed #f0f0f0;
  border-bottom: 1px dashed #f0f0f0;
}

.verdict-block {
  display: flex;
  align-items: center;
  gap: 6px;
}

.verdict-label {
  font-size: 12px;
  color: #8c8c8c;
}

.arrow {
  color: #c0c4cc;
  font-size: 14px;
}

.card-footer {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  color: #8c8c8c;
}

.mastery {
  font-variant-numeric: tabular-nums;
  color: #409eff;
  font-weight: 500;
}

.pagination {
  margin-top: 16px;
  display: flex;
  justify-content: flex-end;
}
</style>