<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { Document, Collection } from '@element-plus/icons-vue'
import { listDocuments, type DocumentItem } from '@/api/documents'
import { getTopicTree, type TopicTreeNode } from '@/api/knowledge'

// ============================================================
// 事件
// ============================================================
const emit = defineEmits<{
  (
    e: 'select',
    payload: { type: 'topic' | 'document'; id: string; name: string } | null,
  ): void
}>()

// ============================================================
// 状态
// ============================================================
const activeTab = ref<'topic' | 'document'>('topic')

// topic 树
const topicTree = ref<TopicTreeNode[]>([])
const topicLoading = ref(false)

// ★ 默认展开的 keys（只在首次加载时设置一次，后续不变）
const defaultExpandedKeys = ref<string[]>([])

// 文档列表
const documents = ref<DocumentItem[]>([])
const docLoading = ref(false)

// 当前选中
const selectedKey = ref<string | null>(null)
const selectedType = ref<'topic' | 'document' | null>(null)

// ============================================================
// 加载
// ============================================================
async function loadTopicTree() {
  topicLoading.value = true
  try {
    const res = await getTopicTree()
    topicTree.value = res.tree ?? []

    // ★ 只在首次加载时设置默认展开，后续 refresh 不覆盖
    // 否则用户手动收起的节点会在下次刷新时被重新展开
    if (defaultExpandedKeys.value.length === 0) {
      defaultExpandedKeys.value = topicTree.value.map((t) => t.id)
    }
  } catch (err: any) {
    console.error('[ConceptTreeNav] load topic tree failed', err)
  } finally {
    topicLoading.value = false
  }
}

async function loadDocuments() {
  docLoading.value = true
  try {
    const res = await listDocuments()
    // 只展示已处理完成的文档
    documents.value = res.documents.filter((d) => d.stage === 'done')
  } catch (err: any) {
    console.error('[ConceptTreeNav] load documents failed', err)
  } finally {
    docLoading.value = false
  }
}

// ============================================================
// 交互
// ============================================================
function onTopicNodeClick(data: TopicTreeNode) {
  selectedKey.value = data.id
  selectedType.value = 'topic'
  emit('select', { type: 'topic', id: data.id, name: data.name })
}

function onDocumentClick(doc: DocumentItem) {
  selectedKey.value = doc.id
  selectedType.value = 'document'
  emit('select', { type: 'document', id: doc.id, name: doc.title })
}

function onClearSelect() {
  selectedKey.value = null
  selectedType.value = null
  emit('select', null)
}

function onTabChange(_tab: string | number) {
  // 切 tab 清空选中
  selectedKey.value = null
  selectedType.value = null
  emit('select', null)
}

// ============================================================
// 生命周期
// ============================================================
onMounted(() => {
  loadTopicTree()
  loadDocuments()
})

defineExpose({
  refresh: () => {
    loadTopicTree()
    loadDocuments()
  },
})
</script>

<template>
  <div class="concept-tree-nav">
    <el-tabs v-model="activeTab" class="nav-tabs" @tab-change="onTabChange">
      <!-- 按主题 -->
      <el-tab-pane name="topic">
        <template #label>
          <span class="tab-label">
            <el-icon><Collection /></el-icon>
            <span>按主题</span>
          </span>
        </template>

        <div v-loading="topicLoading" class="tab-body">
          <div
            v-if="selectedKey || selectedType"
            class="reset-row"
            @click="onClearSelect"
          >
            <span>查看全部</span>
          </div>

          <el-tree
            v-if="topicTree.length > 0"
            :data="topicTree"
            node-key="id"
            :props="{ label: 'name', children: 'children' }"
            :highlight-current="true"
            :expand-on-click-node="false"
            :default-expanded-keys="defaultExpandedKeys"
            @node-click="onTopicNodeClick"
          >
            <template #default="{ data }">
              <span
                class="tree-node"
                :class="{ 'is-selected': selectedKey === data.id }"
              >
                <span class="node-name">{{ data.name }}</span>
                <span v-if="data.conceptCount > 0" class="node-count">
                  {{ data.conceptCount }}
                </span>
              </span>
            </template>
          </el-tree>

          <el-empty
            v-else-if="!topicLoading"
            description="暂无主题"
            :image-size="60"
          />
        </div>
      </el-tab-pane>

      <!-- 按文档 -->
      <el-tab-pane name="document">
        <template #label>
          <span class="tab-label">
            <el-icon><Document /></el-icon>
            <span>按文档</span>
          </span>
        </template>

        <div v-loading="docLoading" class="tab-body">
          <div
            v-if="selectedKey || selectedType"
            class="reset-row"
            @click="onClearSelect"
          >
            <span>查看全部</span>
          </div>

          <ul v-if="documents.length > 0" class="doc-list">
            <li
              v-for="doc in documents"
              :key="doc.id"
              class="doc-item"
              :class="{ 'is-selected': selectedKey === doc.id }"
              @click="onDocumentClick(doc)"
            >
              <span class="doc-title" :title="doc.title">{{ doc.title }}</span>
              <span v-if="doc.conceptCount != null" class="doc-count">
                {{ doc.conceptCount }}
              </span>
            </li>
          </ul>

          <el-empty
            v-else-if="!docLoading"
            description="暂无文档"
            :image-size="60"
          />
        </div>
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<style scoped lang="scss">
.concept-tree-nav {
  width: 260px;
  height: 100%;
  border-right: 1px solid #f0f0f0;
  background: #fff;
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
}

.nav-tabs {
  height: 100%;
  display: flex;
  flex-direction: column;

  :deep(.el-tabs__header) {
    margin: 0;
    padding: 0 12px;
    border-bottom: 1px solid #f0f0f0;
    flex-shrink: 0;
  }

  :deep(.el-tabs__nav-wrap::after) {
    display: none;
  }

  :deep(.el-tabs__content) {
    flex: 1;
    overflow: hidden;
    padding: 0;
  }

  :deep(.el-tab-pane) {
    height: 100%;
    display: flex;
    flex-direction: column;
  }
}

.tab-label {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
}

.tab-body {
  flex: 1;
  overflow-y: auto;
  padding: 8px 0;
}

.reset-row {
  padding: 6px 16px;
  margin-bottom: 4px;
  font-size: 12px;
  color: #409eff;
  cursor: pointer;
  border-bottom: 1px dashed #f0f0f0;

  &:hover {
    background: #f5f9ff;
  }
}

/* ============================================================
   Topic 树
   ============================================================ */
:deep(.el-tree) {
  background: transparent;
  font-size: 13px;

  .el-tree-node__content {
    height: 32px;
    padding-right: 12px;

    &:hover {
      background: #f5f5f5;
    }
  }

  .el-tree-node.is-current > .el-tree-node__content {
    background: #ecf5ff;
    color: #409eff;
  }
}

.tree-node {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding-right: 8px;
}

.node-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.node-count {
  font-size: 11px;
  color: #8c8c8c;
  background: #f5f5f5;
  padding: 1px 6px;
  border-radius: 8px;
  flex-shrink: 0;
  margin-left: 8px;

  :deep(.el-tree-node.is-current) & {
    background: #b3d8ff;
    color: #fff;
  }
}

/* ============================================================
   文档列表
   ============================================================ */
.doc-list {
  margin: 0;
  padding: 0;
  list-style: none;
}

.doc-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 16px;
  cursor: pointer;
  font-size: 13px;
  color: #333;

  &:hover {
    background: #f5f5f5;
  }

  &.is-selected {
    background: #ecf5ff;
    color: #409eff;
  }
}

.doc-title {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
}

.doc-count {
  font-size: 11px;
  color: #8c8c8c;
  background: #f5f5f5;
  padding: 1px 6px;
  border-radius: 8px;
  flex-shrink: 0;
  margin-left: 8px;

  .doc-item.is-selected & {
    background: #b3d8ff;
    color: #fff;
  }
}
</style>