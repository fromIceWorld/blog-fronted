<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { GraphData, GraphNode, GraphNodeStatus } from '@/api/graph'

// ============================================================
// Props / Emits
// ============================================================
const props = defineProps<{
  data: GraphData | null
  selectedNodeId: string | null
}>()

const emit = defineEmits<{
  (e: 'select-node', nodeId: string): void
}>()

// ============================================================
// 折叠状态
// ============================================================
const collapsed = ref(true)

// ============================================================
// 筛选状态
// ============================================================
const filterDomain = ref<string>('')
const searchText = ref('')

// ============================================================
// 所有可用 domain
// ============================================================
const availableDomains = computed(() => {
  if (!props.data) return []
  const set = new Set<string>()
  props.data.nodes.forEach((n) => set.add(n.domain ?? '未分类'))
  return Array.from(set).sort()
})

// ============================================================
// 树节点类型
// ============================================================
interface TreeNode {
  id: string
  label: string
  nodeId?: string
  domain?: string
  isDomain: boolean
  masteryScore?: number
  status?: GraphNodeStatus
  children?: TreeNode[]
}

// ============================================================
// 从 GraphData 构建树
// ============================================================
const treeData = computed<TreeNode[]>(() => {
  if (!props.data) return []

  const byDomain = new Map<string, GraphNode[]>()
  props.data.nodes.forEach((n) => {
    const d = n.domain ?? '未分类'
    if (!byDomain.has(d)) byDomain.set(d, [])
    byDomain.get(d)!.push(n)
  })

  const domainNodes: TreeNode[] = []
  byDomain.forEach((nodes, domain) => {
    const nodeMap = new Map(nodes.map((n) => [n.id, n]))
    const childrenMap = new Map<string, GraphNode[]>()
    const rootNodes: GraphNode[] = []

    nodes.forEach((n) => {
      if (n.parentId && nodeMap.has(n.parentId)) {
        if (!childrenMap.has(n.parentId)) childrenMap.set(n.parentId, [])
        childrenMap.get(n.parentId)!.push(n)
      } else {
        rootNodes.push(n)
      }
    })

    const buildNode = (n: GraphNode): TreeNode => {
      const children = (childrenMap.get(n.id) ?? []).map(buildNode)
      return {
        id: `node-${n.id}`,
        label: n.name,
        nodeId: n.id,
        domain,
        isDomain: false,
        masteryScore: n.masteryScore,
        status: n.status,
        children: children.length > 0 ? children : undefined,
      }
    }

    domainNodes.push({
      id: `domain-${domain}`,
      label: `${domain} (${nodes.length})`,
      domain,
      isDomain: true,
      children: rootNodes.map(buildNode),
    })
  })

  return domainNodes.sort((a, b) => a.label.localeCompare(b.label))
})

// ============================================================
// 过滤后的树
// ============================================================
const filteredTree = computed<TreeNode[]>(() => {
  let result = treeData.value

  if (filterDomain.value) {
    result = result.filter((d) => d.domain === filterDomain.value)
  }

  const search = searchText.value.trim().toLowerCase()
  if (!search) return result

  const filterNode = (node: TreeNode): TreeNode | null => {
    const labelMatch = node.label.toLowerCase().includes(search)
    const filteredChildren = node.children
      ?.map(filterNode)
      .filter((x): x is TreeNode => x !== null)

    if (labelMatch || (filteredChildren && filteredChildren.length > 0)) {
      return {
        ...node,
        children:
          filteredChildren && filteredChildren.length > 0
            ? filteredChildren
            : undefined,
      }
    }
    return null
  }

  return result
    .map(filterNode)
    .filter((x): x is TreeNode => x !== null)
})

// ============================================================
// 展开状态
// ============================================================
const expandedKeys = ref<string[]>([])

watch(
  treeData,
  () => {
    expandedKeys.value = treeData.value.map((d) => d.id)
  },
  { immediate: true },
)

watch(searchText, (val) => {
  if (val.trim()) {
    const collectIds = (nodes: TreeNode[]): string[] => {
      const ids: string[] = []
      nodes.forEach((n) => {
        ids.push(n.id)
        if (n.children) ids.push(...collectIds(n.children))
      })
      return ids
    }
    expandedKeys.value = collectIds(filteredTree.value)
  } else {
    expandedKeys.value = treeData.value.map((d) => d.id)
  }
})

// ============================================================
// 节点点击
// ============================================================
function onTreeNodeClick(node: TreeNode) {
  if (!node.nodeId) return
  emit('select-node', node.nodeId)
}

// ============================================================
// 状态色
// ============================================================
const STATUS_COLORS: Record<GraphNodeStatus, string> = {
  'not-started': '#94a3b8',
  learning: '#f59e0b',
  proficient: '#3b82f6',
  mastered: '#10b981',
}

function getStatusColor(status?: GraphNodeStatus): string {
  return STATUS_COLORS[status ?? 'not-started'] ?? '#94a3b8'
}
</script>

<template>
  <div class="navigator" :class="{ collapsed }">
    <div class="navigator-header" @click="collapsed = !collapsed">
      <span class="title">
        <span class="dot-icon">◉</span>
        目录
      </span>
      <span class="toggle">{{ collapsed ? '▲' : '▼' }}</span>
    </div>

    <div v-show="!collapsed" class="navigator-body">
      <!-- 筛选区 -->
      <div class="filters">
        <el-select
          v-model="filterDomain"
          placeholder="全部领域"
          size="small"
          clearable
          class="domain-select"
        >
          <el-option label="全部领域" value="" />
          <el-option
            v-for="d in availableDomains"
            :key="d"
            :label="d"
            :value="d"
          />
        </el-select>
        <el-input
          v-model="searchText"
          placeholder="搜索节点名"
          size="small"
          clearable
          class="search-input"
        >
          <template #prefix>
            <span class="search-icon">🔍</span>
          </template>
        </el-input>
      </div>

      <!-- 树 -->
      <div class="tree-wrap">
        <el-tree
          :data="filteredTree"
          :default-expanded-keys="expandedKeys"
          :expand-on-click-node="false"
          :highlight-current="true"
          node-key="id"
          empty-text="无匹配节点"
          @node-click="onTreeNodeClick"
        >
          <template #default="{ data }">
            <div class="tree-node" :class="{ 'is-domain': data.isDomain }">
              <span
                v-if="!data.isDomain"
                class="node-dot"
                :style="{ background: getStatusColor(data.status) }"
              />
              <span class="label" :title="data.label">{{ data.label }}</span>
              <span
                v-if="!data.isDomain && data.masteryScore !== undefined"
                class="mastery"
              >
                {{ Math.round(data.masteryScore * 100) }}%
              </span>
            </div>
          </template>
        </el-tree>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
/* ============================================================
   容器：白色半透明卡片
   ============================================================ */
.navigator {
  position: absolute;
  top: 16px;
  right: 16px;
  width: 320px;
  max-height: calc(100% - 32px);
  background: rgba(255, 255, 255, 0.96);
  border: 1px solid rgba(15, 23, 42, 0.08);
  border-radius: 10px;
  box-shadow: 0 4px 20px rgba(15, 23, 42, 0.08);
  z-index: 10;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  backdrop-filter: blur(12px);

  &.collapsed {
    width: 120px;
    max-height: none;
  }
}

/* ============================================================
   头部
   ============================================================ */
.navigator-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 14px;
  cursor: pointer;
  color: #1f2937;
  font-size: 13px;
  font-weight: 600;
  user-select: none;
  border-bottom: 1px solid rgba(15, 23, 42, 0.06);
  flex-shrink: 0;
  transition: background 0.15s;

  &:hover {
    background: rgba(15, 23, 42, 0.03);
  }
}

.title {
  display: flex;
  align-items: center;
  gap: 6px;
}

.dot-icon {
  color: #fbbf24; /* 呼应画布 root 星的琥珀色 */
  font-size: 10px;
}

.toggle {
  font-size: 10px;
  color: #94a3b8;
}

/* ============================================================
   主体
   ============================================================ */
.navigator-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
}

/* ============================================================
   筛选区
   ============================================================ */
.filters {
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  border-bottom: 1px solid rgba(15, 23, 42, 0.06);
  flex-shrink: 0;
}

.domain-select,
.search-input {
  width: 100%;

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

  :deep(.el-input__suffix) {
    color: #94a3b8;
  }
}

.search-icon {
  font-size: 12px;
  opacity: 0.5;
}

/* ============================================================
   树
   ============================================================ */
.tree-wrap {
  flex: 1;
  overflow-y: auto;
  padding: 6px 4px;

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

  :deep(.el-tree) {
    background: transparent;
    color: #374151;
    font-size: 13px;
  }

  :deep(.el-tree-node__content) {
    height: 28px;
    background: transparent;
    border-radius: 4px;
    margin: 1px 4px;
    transition: background 0.15s;

    &:hover {
      background: rgba(15, 23, 42, 0.04);
    }
  }

  /* ★ 选中态：主蓝色背景 + 主蓝文字（和画布选中色一致） */
  :deep(.el-tree-node.is-current > .el-tree-node__content) {
    background: rgba(37, 99, 235, 0.08);
    color: #2563eb;
    font-weight: 500;
  }

  :deep(.el-tree-node__expand-icon) {
    color: #94a3b8;
  }

  :deep(.el-tree-node__expand-icon.is-leaf) {
    color: transparent;
  }
}

.tree-node {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  padding-right: 8px;
  overflow: hidden;

  &.is-domain {
    font-weight: 600;
    color: #64748b;
    text-transform: uppercase;
    font-size: 11px;
    letter-spacing: 0.5px;
  }
}

.node-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
}

.label {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mastery {
  font-size: 11px;
  color: #94a3b8;
  flex-shrink: 0;
  font-variant-numeric: tabular-nums;
}
</style>