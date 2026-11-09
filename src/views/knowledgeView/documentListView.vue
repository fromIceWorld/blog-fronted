<script setup lang="ts">
import { ref, computed, onMounted, onActivated } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Refresh, Plus } from '@element-plus/icons-vue'
import {
  listDocuments,
  deleteDocument,
  type DocumentItem,
} from '@/api/documents'
import UploadDialog from './components/UploadDialog.vue'
import UploadTaskFloater from './components/UploadTaskFloater.vue'

// ============================================================
// 状态
// ============================================================
const documents = ref<DocumentItem[]>([])
const loading = ref(false)
const uploadDialogVisible = ref(false)
const floaterRef = ref<InstanceType<typeof UploadTaskFloater>>()

// 只展示已完成的文档（处理中/失败的任务交给悬浮球）
const readyDocuments = computed(() =>
  documents.value.filter((d) => d.stage === 'done'),
)

// ============================================================
// 加载
// ============================================================
async function loadDocuments() {
  loading.value = true
  try {
    const res = await listDocuments()
    console.log('res', res)
    documents.value = res.documents
  } catch (err: any) {
    ElMessage.error(err.message ?? '加载文档列表失败')
  } finally {
    loading.value = false
  }
}

// ============================================================
// 上传
// ============================================================
function onUploaded(documentId: string) {
  if (!documentId) {
    console.error('[DocumentListView] onUploaded 收到空 documentId')
    return
  }
  uploadDialogVisible.value = false
  floaterRef.value?.notifyUploaded(documentId)
}

// ============================================================
// 悬浮球通知：有文档处理完成 → 刷新列表
// ============================================================
function onDocumentCompleted(_documentId: string) {
  // ★ 延迟 500ms 再刷新，避免和后端事务提交竞争
  setTimeout(() => loadDocuments(), 500)
}

// ============================================================
// 删除
// ============================================================
async function onDelete(row: DocumentItem) {
  try {
    await ElMessageBox.confirm(
      `确定删除文档「${row.title}」吗？\n该文档关联的概念、关系、题目会一起删除。`,
      '删除确认',
      {
        type: 'warning',
        confirmButtonText: '删除',
        cancelButtonText: '取消',
        dangerouslyUseHTMLString: false,
      },
    )
  } catch {
    return // 用户取消
  }

  try {
    await deleteDocument(row.id)
    ElMessage.success('已删除')
    await loadDocuments()
  } catch (err: any) {
    ElMessage.error(err.message ?? '删除失败')
  }
}

// ============================================================
// 格式化
// ============================================================
function formatDate(date: string): string {
  return new Date(date).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// ============================================================
// 生命周期
// ============================================================
onMounted(loadDocuments)
// KeepAlive 下切回该 tab 时刷新
onActivated(loadDocuments)

// 暴露给父组件（如果需要外部触发刷新）
defineExpose({
  refresh: loadDocuments,
})
</script>

<template>
  <div class="document-list-view">
    <!-- ============================================================
         工具栏
         ============================================================ -->
    <div class="toolbar">
      <div class="toolbar-left">
        <span class="count">
          {{ readyDocuments.length }} 份知识文档
        </span>
      </div>
      <div class="toolbar-right">
        <el-button
          :icon="Refresh"
          :loading="loading"
          @click="loadDocuments"
        >
          刷新
        </el-button>
        <el-button
          type="primary"
          :icon="Plus"
          @click="uploadDialogVisible = true"
        >
          上传文档
        </el-button>
      </div>
    </div>

    <!-- ============================================================
         文档列表（只展示已完成）
         ============================================================ -->
    <div class="list-body" v-loading="loading">
      <el-table
        v-if="readyDocuments.length > 0"
        :data="readyDocuments"
        stripe
        row-key="id"
        class="doc-table"
      >
        <el-table-column prop="title" label="标题" min-width="260">
          <template #default="{ row }">
            <div class="title-cell">
              <span class="title-text">{{ row.title }}</span>
              <span v-if="row.sourceType" class="source-type">
                {{ row.sourceType }}
              </span>
            </div>
          </template>
        </el-table-column>

        <el-table-column label="概念数" width="100" align="center">
          <template #default="{ row }">
            <span v-if="row.conceptCount != null" class="stat-num">
              {{ row.conceptCount }}
            </span>
            <span v-else class="stat-empty">-</span>
          </template>
        </el-table-column>

        <el-table-column label="题目数" width="100" align="center">
          <template #default="{ row }">
            <span v-if="row.questionCount != null" class="stat-num">
              {{ row.questionCount }}
            </span>
            <span v-else class="stat-empty">-</span>
          </template>
        </el-table-column>

        <el-table-column label="创建时间" width="180">
          <template #default="{ row }">
            <span class="time-text">{{ formatDate(row.createdAt) }}</span>
          </template>
        </el-table-column>

        <el-table-column label="操作" width="100" fixed="right" align="center">
          <template #default="{ row }">
            <el-button link type="danger" @click="onDelete(row)">
              删除
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <!-- 空状态 -->
      <div v-else-if="!loading" class="empty-tip">
        <el-empty description="还没有知识文档">
          <el-button
            type="primary"
            :icon="Plus"
            @click="uploadDialogVisible = true"
          >
            上传第一份文档
          </el-button>
        </el-empty>
      </div>
    </div>

    <!-- ============================================================
         上传弹窗
         ============================================================ -->
    <UploadDialog
      v-model:visible="uploadDialogVisible"
      @uploaded="onUploaded"
    />

    <!-- ============================================================
         处理任务悬浮球
         展示处理中/失败的任务，完成后通知本组件刷新列表
         ============================================================ -->
    <UploadTaskFloater
      ref="floaterRef"
      @document-completed="onDocumentCompleted"
    />
  </div>
</template>

<style scoped lang="scss">
.document-list-view {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #fafafa;
}

/* ============================================================
   工具栏
   ============================================================ */
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
  color: #1f1f1f;
}

.count {
  font-size: 13px;
  color: #8c8c8c;
}

.toolbar-right {
  display: flex;
  gap: 8px;
}

/* ============================================================
   列表
   ============================================================ */
.list-body {
  flex: 1;
  overflow: auto;
  padding: 16px 24px;
  position: relative;
}

.doc-table {
  background: #fff;
  border-radius: 6px;
  overflow: hidden;
}

.title-cell {
  display: flex;
  align-items: center;
  gap: 8px;
}

.title-text {
  font-weight: 500;
  color: #1f1f1f;
}

.source-type {
  font-size: 12px;
  color: #8c8c8c;
  padding: 2px 6px;
  background: #f5f5f5;
  border-radius: 3px;
  flex-shrink: 0;
}

.stat-num {
  font-weight: 500;
  color: #409eff;
  font-variant-numeric: tabular-nums;
}

.stat-empty {
  color: #c0c4cc;
}

.time-text {
  font-size: 13px;
  color: #595959;
  font-variant-numeric: tabular-nums;
}

/* ============================================================
   空状态
   ============================================================ */
.empty-tip {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  min-height: 400px;
}
</style>