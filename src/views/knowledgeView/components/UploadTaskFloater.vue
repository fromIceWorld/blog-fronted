<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Loading, Warning, Check } from '@element-plus/icons-vue'
import {
  getDocumentsBatchStatus,
  retryDocument,
  deleteDocument,
  type DocumentItem,
} from '@/api/documents'
import { useMyUploads } from '../composables/useMyUploads'

const STORAGE_KEY = 'knowledge_my_uploads'

const emit = defineEmits<{
  (e: 'document-completed', documentId: string): void
}>()

const { uploadIds, add, remove } = useMyUploads()

const tasks = ref<DocumentItem[]>([])
const popoverVisible = ref(false)
const recentlyCompleted = ref<Set<string>>(new Set())

let pollTimer: number | null = null

// ============================================================
// 派生
// ============================================================
const processingTasks = computed(() =>
  tasks.value.filter((t) => t.stage !== 'done' && t.stage !== 'failed'),
)
const failedTasks = computed(() => tasks.value.filter((t) => t.stage === 'failed'))
const showFloater = computed(
  () => processingTasks.value.length > 0 || failedTasks.value.length > 0,
)
const badgeContent = computed(() => {
  if (failedTasks.value.length > 0) return '!'
  return processingTasks.value.length > 0
    ? String(processingTasks.value.length)
    : ''
})
const badgeType = computed(() =>
  failedTasks.value.length > 0 ? 'danger' : 'primary',
)
const hasFailed = computed(() => failedTasks.value.length > 0)

// ============================================================
// 轮询
// ============================================================
async function poll(): Promise<void> {
  // ① 过滤无效 ID
  const validIds = uploadIds.value.filter(
    (id) => typeof id === 'string' && id.trim() !== '',
  )
  if (validIds.length !== uploadIds.value.length) {
    console.warn('[floater] 清理无效 ID:', uploadIds.value)
    uploadIds.value = validIds
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(validIds))
  }

  if (validIds.length === 0) {
    tasks.value = []
    stopPolling()
    return
  }

  // ② 请求 + 兼容解包
  let docs: DocumentItem[] = []
  try {
    const raw: any = await getDocumentsBatchStatus(validIds)
    // ★ 兼容：AxiosResponse (`{ data: { documents } }`) 或已解包 (`{ documents }`)
    docs = raw?.documents ?? raw?.data?.documents ?? []
    console.log(
      '[floater] poll response:',
      docs.map((d) => ({ id: d.id, stage: d.stage })),
    )
  } catch (err) {
    console.error('[floater] poll failed', err)
    return // ★ 出错直接返回，不影响 remove 逻辑
  }

  // ③ 先处理 done 的（无论后面逻辑如何，remove 一定要执行）
  const doneDocs = docs.filter((d) => d.stage === 'done')
  for (const doc of doneDocs) {
    remove(doc.id) // 无条件从追踪列表移除
    if (!recentlyCompleted.value.has(doc.id)) {
      recentlyCompleted.value.add(doc.id)
      emit('document-completed', doc.id)
      setTimeout(() => recentlyCompleted.value.delete(doc.id), 3000)
    }
  }
  if (doneDocs.length > 0) {
    console.log('[floater] after remove, uploadIds =', uploadIds.value)
  }

  // ④ 更新 tasks（只保留还在追踪且非 done 的）
  tasks.value = docs.filter(
    (d) => d.stage !== 'done' && uploadIds.value.includes(d.id),
  )

  // ⑤ 全部清完 → 停轮询
  if (uploadIds.value.length === 0) {
    stopPolling()
  }
}

function startPolling(interval = 3000): void {
  stopPolling()
  poll()
  pollTimer = window.setInterval(poll, interval)
}

function stopPolling(): void {
  if (pollTimer !== null) {
    clearInterval(pollTimer)
    pollTimer = null
  }
}

watch(popoverVisible, (visible) => {
  if (uploadIds.value.length === 0) return
  startPolling(visible ? 2000 : 5000)
})

// ============================================================
// 生命周期
// ============================================================
onMounted(async () => {
  // ★ 启动时先清理历史遗留的 done ID
  if (uploadIds.value.length > 0) {
    try {
      const raw: any = await getDocumentsBatchStatus(uploadIds.value)
      const docs: DocumentItem[] = raw?.documents ?? raw?.data?.documents ?? []
      const doneIds = docs.filter((d) => d.stage === 'done').map((d) => d.id)
      for (const id of doneIds) {
        remove(id)
        if (!recentlyCompleted.value.has(id)) {
          recentlyCompleted.value.add(id)
          emit('document-completed', id)
        }
      }
      if (doneIds.length > 0) {
        console.log(`[floater] 启动清理 ${doneIds.length} 个已完成任务`)
      }
    } catch (err) {
      console.error('[floater] 启动清理失败', err)
    }
  }

  // 还有剩余任务 → 开始轮询
  if (uploadIds.value.length > 0) {
    startPolling(3000)
  }
})

onUnmounted(() => {
  stopPolling()
})

// ============================================================
// 操作
// ============================================================
async function onRetry(task: DocumentItem): Promise<void> {
  try {
    await retryDocument(task.id)
    ElMessage.success('已重新提交处理')
    await poll()
  } catch (err: any) {
    ElMessage.error(err.message ?? '重试失败')
  }
}

async function onDelete(task: DocumentItem): Promise<void> {
  try {
    await ElMessageBox.confirm(`确定删除「${task.title}」吗？`, '删除确认', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消',
    })
  } catch {
    return
  }

  try {
    await deleteDocument(task.id)
    remove(task.id)
    tasks.value = tasks.value.filter((t) => t.id !== task.id)
    ElMessage.success('已删除')
    if (uploadIds.value.length === 0) stopPolling()
  } catch (err: any) {
    ElMessage.error(err.message ?? '删除失败')
  }
}

// ============================================================
// 工具
// ============================================================
function stageLabel(stage: string): string {
  const map: Record<string, string> = {
    uploaded: '等待处理',
    l0_done: '解析文档',
    l1a_done: '切分结构',
    l1b_done: '构建单元',
    l2_done: '抽取概念',
    l3_done: '构建关系',
    failed: '处理失败',
  }
  return map[stage] ?? stage
}

// ============================================================
// 暴露
// ============================================================
defineExpose({
  notifyUploaded(documentId: string): void {
    add(documentId)
    setTimeout(() => startPolling(2000), 500)
  },
})
</script>

<template>
  <Teleport to="body">
    <div v-if="showFloater" class="floater-container">
      <el-popover
        v-model:visible="popoverVisible"
        placement="top-end"
        :width="360"
        trigger="click"
        popper-class="upload-task-popover"
      >
        <template #reference>
          <el-badge
            :value="badgeContent"
            :type="badgeType"
            :hidden="!badgeContent"
            class="floater-badge"
          >
            <el-button
              circle
              size="large"
              class="floater-btn"
              :class="{ 'has-failed': hasFailed }"
            >
              <el-icon :size="20">
                <Loading
                  v-if="processingTasks.length > 0 && failedTasks.length === 0"
                  class="rotating"
                />
                <Warning v-else />
              </el-icon>
            </el-button>
          </el-badge>
        </template>

        <div class="task-popover">
          <div class="popover-header">
            <span class="title">上传任务</span>
            <span class="count">
              {{ processingTasks.length + failedTasks.length }}
            </span>
          </div>

          <div class="task-list">
            <div
              v-for="task in failedTasks"
              :key="`failed-${task.id}`"
              class="task-item failed"
            >
              <div class="task-row">
                <el-icon class="status-icon" color="#f56c6c"><Warning /></el-icon>
                <span class="task-title" :title="task.title">{{ task.title }}</span>
              </div>
              <div class="task-meta">
                <span class="error-text">{{ task.errorMessage ?? '处理失败' }}</span>
              </div>
              <div class="task-actions">
                <el-button size="small" type="primary" link @click="onRetry(task)">
                  重试
                </el-button>
                <el-button size="small" type="danger" link @click="onDelete(task)">
                  删除
                </el-button>
              </div>
            </div>

            <div
              v-for="task in processingTasks"
              :key="`processing-${task.id}`"
              class="task-item processing"
            >
              <div class="task-row">
                <el-icon class="status-icon rotating" color="#409eff">
                  <Loading />
                </el-icon>
                <span class="task-title" :title="task.title">{{ task.title }}</span>
              </div>
              <div class="task-meta">
                <span class="stage-text">{{ stageLabel(task.stage) }}</span>
                <span class="progress-text">{{ task.progress }}%</span>
              </div>
              <el-progress
                :percentage="task.progress"
                :show-text="false"
                :stroke-width="3"
              />
            </div>

            <div
              v-if="processingTasks.length === 0 && failedTasks.length === 0"
              class="task-empty"
            >
              <el-icon><Check /></el-icon>
              <span>全部处理完成</span>
            </div>
          </div>
        </div>
      </el-popover>
    </div>
  </Teleport>
</template>

<style scoped lang="scss">
.floater-container {
  position: fixed;
  bottom: 24px;
  right: 24px;
  z-index: 2000;
}

.floater-btn {
  width: 52px;
  height: 52px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  background: #fff;
  border: 1px solid #e5e5e5;
  transition: transform 0.2s, box-shadow 0.2s;

  &:hover {
    transform: scale(1.05);
    box-shadow: 0 6px 16px rgba(0, 0, 0, 0.2);
  }

  &.has-failed {
    border-color: #f56c6c;
    background: #fef0f0;
  }
}

.rotating {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.task-popover {
  display: flex;
  flex-direction: column;
  max-height: 400px;
}

.popover-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0 12px;
  border-bottom: 1px solid #f0f0f0;
  margin-bottom: 8px;
}

.title {
  font-weight: 600;
  font-size: 14px;
  color: #1f1f1f;
}

.count {
  font-size: 12px;
  color: #8c8c8c;
}

.task-list {
  overflow-y: auto;
  flex: 1;
  margin: 0 -4px;
  padding: 0 4px;

  &::-webkit-scrollbar { width: 4px; }
  &::-webkit-scrollbar-thumb {
    background: #d9d9d9;
    border-radius: 2px;
  }
}

.task-item {
  padding: 10px 0;
  border-bottom: 1px solid #f5f5f5;
  &:last-child { border-bottom: none; }
  &.failed {
    background: #fef8f8;
    padding: 10px 8px;
    border-radius: 4px;
    margin-bottom: 6px;
    border-bottom: none;
  }
}

.task-row {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 6px;
}

.status-icon { flex-shrink: 0; }

.task-title {
  font-size: 13px;
  font-weight: 500;
  color: #1f1f1f;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
}

.task-meta {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  color: #8c8c8c;
  margin-bottom: 6px;
  padding-left: 22px;
}

.error-text {
  color: #f56c6c;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 100%;
}

.stage-text { color: #595959; }

.progress-text {
  color: #409eff;
  font-variant-numeric: tabular-nums;
  font-weight: 500;
}

.task-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding-left: 22px;
}

.task-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 24px 0;
  color: #8c8c8c;
  font-size: 13px;
  .el-icon { color: #52c41a; font-size: 24px; }
}
</style>