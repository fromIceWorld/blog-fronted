<script setup lang="ts">
import { onMounted, ref, computed, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Search } from '@element-plus/icons-vue'
import { fetchGraph, type GraphData, type GraphNode } from '@/api/graph'
import { listTopics, type Topic } from '@/api/knowledge.ts'
import GraphCanvas from './components/GraphCanvas.vue'
import NodeDetailPanel from './components/NodeDetailPanel.vue'
import GraphLegend from './components/GraphLegend.vue'
import GraphNavigator from './components/GraphNavigator.vue'

const graphCanvasRef = ref()
const route = useRoute()
const router = useRouter()

const topics = ref<Topic[]>([])
const selectedTopicId = ref<string | null>(null)
const graphData = ref<GraphData | null>(null)
const loading = ref(false)
const selectedNodeId = ref<string | null>(null)

const searchQuery = ref('')
const searchFocused = ref(false)

const selectedNode = computed<GraphNode | null>(() => {
  if (!selectedNodeId.value || !graphData.value) return null
  return (
    graphData.value.nodes.find((n) => n.id === selectedNodeId.value) ?? null
  )
})

const searchResults = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  if (!q || !graphData.value) return []
  return graphData.value.nodes
    .filter(
      (n) =>
        n.name?.toLowerCase().includes(q) ||
        n.definition?.toLowerCase().includes(q),
    )
    .slice(0, 12)
})

const showSearchDropdown = computed(
  () => searchFocused.value && !!searchQuery.value.trim(),
)

const drawerVisible = ref(false)

function onOpenDetail(nodeId: string) {
  if (selectedNodeId.value !== nodeId) {
    selectedNodeId.value = nodeId
  }
  drawerVisible.value = true
}

function onDrawerClose() {
  drawerVisible.value = false
}

function onNavigateNode(nodeId: string) {
  selectedNodeId.value = nodeId
  nextTick(() => {
    graphCanvasRef.value?.focusOnNode?.(nodeId)
  })
}

function onSearchResultClick(node: GraphNode) {
  searchQuery.value = ''
  searchFocused.value = false
  onNavigateNode(node.id)
}

function onSearchBlur() {
  setTimeout(() => {
    searchFocused.value = false
  }, 200)
}

async function loadTopics() {
  const res = await listTopics()
  topics.value = res.topics
  const fromQuery = route.query.topicId as string | undefined
  selectedTopicId.value =
    fromQuery && topics.value.some((t) => t.id === fromQuery)
      ? fromQuery
      : topics.value[0]?.id ?? null
}

async function loadGraph() {
  if (!selectedTopicId.value) return
  loading.value = true
  selectedNodeId.value = null
  searchQuery.value = ''
  try {
    const topicId: any =
      selectedTopicId.value === '__all__' ? undefined : selectedTopicId.value
    graphData.value = await fetchGraph(topicId)
  } finally {
    loading.value = false
  }
}

function onTopicChange() {
  if (selectedTopicId.value) {
    router.replace({ query: { topicId: selectedTopicId.value } })
  }
  loadGraph()
}

function onSelectNode(nodeId: string | null) {
  selectedNodeId.value = nodeId
}

function onNavigate(nodeId: string) {
  selectedNodeId.value = nodeId
}

function onPractice(nodeId: string) {
  router.push({ path: '/practice', query: { conceptId: nodeId } })
}

onMounted(async () => {
  await loadTopics()
  await loadGraph()
})
</script>

<template>
  <div class="graph-view">
    <div class="main-area" v-loading="loading">
      <GraphCanvas
        ref="graphCanvasRef"
        :data="graphData"
        :selected-node-id="selectedNodeId"
        @select-node="onSelectNode"
        @open-detail="onOpenDetail"
      />
      <GraphLegend />

      <GraphNavigator
        :data="graphData"
        :selected-node-id="selectedNodeId"
        @select-node="onNavigateNode"
      />

      <!-- ★ 左上角浮动控制栏（浅色，和 GraphNavigator 统一） -->
      <div class="canvas-toolbar">
        <div class="toolbar-card">
          <!-- 主题选择 -->
          <el-select
            v-model="selectedTopicId"
            placeholder="选择主题"
            popper-class="light-toolbar-popper"
            class="light-select"
            style="width: 180px"
            @change="onTopicChange"
          >
            <el-option label="全部概念" value="__all__" />
            <el-option
              v-for="t in topics"
              :key="t.id"
              :label="t.name"
              :value="t.id"
            >
              <div class="topic-option">
                <span class="topic-name">{{ t.name }}</span>
                <span class="topic-count">{{ t.nodeCount }}</span>
              </div>
            </el-option>
          </el-select>

          <!-- 搜索 -->
          <div class="search-wrapper">
            <el-input
              v-model="searchQuery"
              placeholder="搜索概念"
              clearable
              class="light-input"
              style="width: 220px"
              @focus="searchFocused = true"
              @blur="onSearchBlur"
            >
              <template #prefix>
                <el-icon><Search /></el-icon>
              </template>
            </el-input>

            <!-- 搜索结果下拉 -->
            <div v-if="showSearchDropdown" class="search-dropdown">
              <template v-if="searchResults.length > 0">
                <div
                  v-for="node in searchResults"
                  :key="node.id"
                  class="search-item"
                  @mousedown.prevent="onSearchResultClick(node)"
                >
                  <div class="search-item-name">{{ node.name }}</div>
                  <div v-if="node.definition" class="search-item-def">
                    {{ node.definition }}
                  </div>
                </div>
              </template>
              <div v-else class="search-empty">没有匹配的概念</div>
            </div>
          </div>
        </div>
      </div>

      <div
        v-if="graphData && graphData.nodes.length === 0"
        class="empty-tip"
      >
        该主题下暂无概念
      </div>
    </div>

    <el-drawer
      v-model="drawerVisible"
      title="节点详情"
      direction="rtl"
      size="400px"
      :with-header="true"
      :destroy-on-close="false"
      :modal="true"
      class="node-drawer"
      @close="onDrawerClose"
    >
      <NodeDetailPanel
        :node="selectedNode"
        :data="graphData"
        @close="drawerVisible = false"
        @navigate="onNavigate"
        @practice="onPractice"
      />
    </el-drawer>
  </div>
</template>

<style scoped lang="scss">
.graph-view {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #f5f5f5;
}

.main-area {
  flex: 1;
  position: relative;
  overflow: hidden;
  background: #fafafa;
}

/* ============================================================
   左上角浮动控制栏（浅色卡片）
   ============================================================ */
.canvas-toolbar {
  position: absolute;
  top: 16px;
  left: 16px;
  z-index: 10;
}

.toolbar-card {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  background: rgba(255, 255, 255, 0.96);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(15, 23, 42, 0.08);
  border-radius: 10px;
  box-shadow: 0 4px 20px rgba(15, 23, 42, 0.08);
}

/* ============================================================
   ★ 浅色 el-input 覆盖
   ============================================================ */
.light-input {
  :deep(.el-input__wrapper) {
    background: #f8fafc;
    box-shadow: 0 0 0 1px #e5e7eb inset;
    border: none;
    transition: all 0.15s;

    &:hover {
      background: #ffffff;
      box-shadow: 0 0 0 1px #cbd5e1 inset;
    }

    &.is-focus {
      background: #ffffff;
      box-shadow: 0 0 0 1px #2563eb inset;
    }
  }

  :deep(.el-input__inner) {
    color: #1f2937;

    &::placeholder {
      color: #94a3b8;
    }
  }

  :deep(.el-input__prefix) {
    color: #94a3b8;
  }

  :deep(.el-input__suffix) {
    color: #94a3b8;
  }

  :deep(.el-input__clear:hover) {
    color: #1f2937;
  }
}

/* ============================================================
   ★ 浅色 el-select 覆盖
   ============================================================ */
.light-select {
  :deep(.el-select__wrapper) {
    background: #f8fafc;
    box-shadow: 0 0 0 1px #e5e7eb inset;
    border: none;
    transition: all 0.15s;

    &:hover {
      background: #ffffff;
      box-shadow: 0 0 0 1px #cbd5e1 inset;
    }

    &.is-focused {
      background: #ffffff;
      box-shadow: 0 0 0 1px #2563eb inset;
    }
  }

  :deep(.el-select__placeholder) {
    color: #1f2937;

    &.is-transparent {
      color: #94a3b8;
    }
  }

  :deep(.el-select__selected-item) {
    color: #1f2937;
  }

  :deep(.el-select__caret) {
    color: #94a3b8;
  }
}

/* 主题下拉项：名字 + 数量 */
.topic-option {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;

  .topic-name {
    flex: 1;
  }
  .topic-count {
    font-size: 12px;
    color: #94a3b8;
    font-variant-numeric: tabular-nums;
  }
}

/* ============================================================
   ★ 搜索下拉（浅色）
   ============================================================ */
.search-wrapper {
  position: relative;
}

.search-dropdown {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  right: 0;
  min-width: 240px;
  max-height: 340px;
  overflow-y: auto;
  background: #ffffff;
  border: 1px solid rgba(15, 23, 42, 0.08);
  border-radius: 8px;
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.12);
  padding: 4px 0;
  z-index: 20;

  /* 浅色滚动条 */
  &::-webkit-scrollbar {
    width: 6px;
  }
  &::-webkit-scrollbar-thumb {
    background: rgba(15, 23, 42, 0.12);
    border-radius: 3px;

    &:hover {
      background: rgba(15, 23, 42, 0.22);
    }
  }
  &::-webkit-scrollbar-track {
    background: transparent;
  }
}

.search-item {
  padding: 8px 12px;
  cursor: pointer;
  transition: background 0.15s;

  &:hover {
    background: rgba(37, 99, 235, 0.06);
  }
}

.search-item-name {
  font-size: 13px;
  color: #1f2937;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.search-item-def {
  font-size: 11px;
  color: #94a3b8;
  margin-top: 2px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.search-empty {
  padding: 16px 12px;
  font-size: 13px;
  color: #94a3b8;
  text-align: center;
}

/* ============================================================
   空提示
   ============================================================ */
.empty-tip {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  color: #8c8c8c;
  font-size: 14px;
  pointer-events: none;
}

/* ============================================================
   抽屉内边距归零
   ============================================================ */
.node-drawer :deep(.el-drawer__body) {
  padding: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
</style>

<!-- ============================================================
     全局样式：el-select 下拉弹层浅色（popper 挂在 body 上，scoped 不生效）
     ============================================================ -->
<style lang="scss">
.light-toolbar-popper.el-popper {
  background: #ffffff !important;
  border: 1px solid rgba(15, 23, 42, 0.08) !important;
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.12) !important;

  .el-popper__arrow::before {
    background: #ffffff !important;
    border-color: rgba(15, 23, 42, 0.08) !important;
  }

  .el-select-dropdown__list {
    padding: 4px 0;
  }

  .el-select-dropdown__item {
    color: #1f2937;

    &:hover,
    &.is-hovering {
      background: rgba(15, 23, 42, 0.04);
    }

    &.is-selected {
      color: #2563eb;
      font-weight: 500;
    }

    .topic-count {
      color: #94a3b8;
    }
  }

  .el-select-dropdown__empty {
    color: #94a3b8;
  }

  /* 浅色滚动条 */
  .el-select-dropdown__wrap::-webkit-scrollbar {
    width: 6px;
  }
  .el-select-dropdown__wrap::-webkit-scrollbar-thumb {
    background: rgba(15, 23, 42, 0.12);
    border-radius: 3px;

    &:hover {
      background: rgba(15, 23, 42, 0.22);
    }
  }
}
</style>