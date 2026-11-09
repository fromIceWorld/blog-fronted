<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, computed, watch } from 'vue'
import { Graph } from '@antv/g6'
import type {
  GraphData,
  GraphNode,
  GraphEdge,
  GraphNodeStatus,
  GraphEdgeType,
} from '@/api/graph'
import { computeDomainLayout } from '../lib/domainLayout'

// ============================================================
// Props / Emits
// ============================================================
const props = defineProps<{
  data: GraphData | null
  selectedNodeId: string | null
}>()

const emit = defineEmits<{
  (e: 'select-node', nodeId: string | null): void
  (e: 'open-detail', nodeId: string): void
}>()

// ============================================================
// 实例 / 缓存
// ============================================================
const containerRef = ref<HTMLDivElement>()
let graph: Graph | null = null
let resizeObserver: ResizeObserver | null = null
let resizeRaf = 0

const descendantCountCache = ref<Map<string, number>>(new Map())

// ============================================================
// 选中状态 ref
// ============================================================
const currentSelectedId = ref<string | null>(null)

const neighborIdSet = computed(() => {
  if (!currentSelectedId.value || !props.data) return new Set<string>()
  const nodeId = currentSelectedId.value
  const set = new Set<string>([nodeId])
  props.data.edges.forEach((e) => {
    if (e.source === nodeId) set.add(e.target)
    if (e.target === nodeId) set.add(e.source)
  })
  return set
})

const activeEdgeIdSet = computed(() => {
  if (!currentSelectedId.value || !props.data) return new Set<string>()
  const nodeId = currentSelectedId.value
  const set = new Set<string>()
  props.data.edges.forEach((e) => {
    if (e.source === nodeId || e.target === nodeId) {
      set.add(edgeId(e))
    }
  })
  return set
})

// ============================================================
// 工具函数
// ============================================================
function truncateText(text: string, maxWidth: number, fontSize: number): string {
  let width = 0
  let result = ''
  for (const c of text) {
    const charWidth = /[\u4e00-\u9fa5]/.test(c) ? fontSize * 1.05 : fontSize * 0.6
    if (width + charWidth > maxWidth) return result + '…'
    result += c
    width += charWidth
  }
  return result
}

function computeDescendantCounts(nodes: GraphNode[]): Map<string, number> {
  const childrenMap = new Map<string, string[]>()
  for (const n of nodes) {
    if (n.parentId) {
      if (!childrenMap.has(n.parentId)) childrenMap.set(n.parentId, [])
      childrenMap.get(n.parentId)!.push(n.id)
    }
  }

  const countMap = new Map<string, number>()
  const visit = (id: string, visited: Set<string>): number => {
    if (countMap.has(id)) return countMap.get(id)!
    if (visited.has(id)) return 0
    visited.add(id)

    const children = childrenMap.get(id) ?? []
    let total = children.length
    for (const child of children) total += visit(child, visited)
    countMap.set(id, total)
    return total
  }

  for (const n of nodes) visit(n.id, new Set())
  return countMap
}

/**
 * 计算颜色亮度（0~1）
 * 用于智能选择文字颜色（深底白字 / 浅底深字）
 */
function getLuminance(hex: string): number {
  let r = 0, g = 0, b = 0
  if (hex.startsWith('#')) {
    r = parseInt(hex.slice(1, 3), 16)
    g = parseInt(hex.slice(3, 5), 16)
    b = parseInt(hex.slice(5, 7), 16)
  } else if (hex.startsWith('rgb')) {
    const nums = hex.match(/\d+/g)?.map(Number) ?? [0, 0, 0]
    ;[r, g, b] = nums
  }
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255
}

/**
 * 根据底色智能选择对比度高的文字色
 * 亮度 > 0.55 → 深色文字；否则白色文字
 */
function pickTextColor(bgColor: string): string {
  return getLuminance(bgColor) > 0.55 ? '#1f2937' : '#ffffff'
}

// ============================================================
// 配色
// ============================================================
const BG_COLOR = '#fafafa'

const DOMAIN_COLORS = [
  '#4E79A7', '#F28E2B', '#E15759', '#76B7B2', '#59A14F',
  '#EDC948', '#B07AA1', '#FF9DA7', '#9C755F', '#BAB0AC',
]

function getDomainColor(domain: string | null): string {
  if (!domain) return DOMAIN_COLORS[0]
  let hash = 0
  for (const c of domain) {
    hash = (hash * 31 + c.charCodeAt(0)) % 100000
  }
  return DOMAIN_COLORS[hash % DOMAIN_COLORS.length]
}

// ★ 状态描边：图谱上唯一的「掌握度表达层」
const STATUS_STROKE: Record<GraphNodeStatus, string> = {
  'not-started': '#94a3b8',   // 灰（全饱和）
  learning: '#f59e0b',         // 橙
  proficient: '#3b82f6',       // 蓝
  mastered: '#10b981',         // 绿
}

// ============================================================
// 边样式
// ============================================================
const EDGE_COLORS: Record<GraphEdgeType, string> = {
  parent: '#94a3b8',
  causes: '#ef4444',
  applies_to: '#3b82f6',
  contrast: '#a855f7',
  example_of: '#22c55e',
  part_of: '#f59e0b',
}

const EDGE_LINE_DASH: Record<GraphEdgeType, number[]> = {
  parent: [],
  causes: [4, 4],
  applies_to: [4, 4],
  contrast: [2, 4],
  example_of: [2, 4],
  part_of: [2, 4],
}

const CURVE_OFFSET: Record<GraphEdgeType, number> = {
  parent: 0,
  causes: 60,
  applies_to: -60,
  contrast: 80,
  example_of: -80,
  part_of: 100,
}

const HIGHLIGHT_PRIMARY = '#2563eb'
const HIGHLIGHT_SECONDARY = '#93c5fd'

const DOMAIN_HUB_TYPE = 'domain-hub'

function edgeId(e: Pick<GraphEdge, 'source' | 'target' | 'type'>): string {
  return `edge:${e.source}->${e.target}:${e.type}`
}

// ============================================================
// 判断是否需要 domain 分组
// ============================================================
function needsDomainGrouping(data: GraphData | null): boolean {
  if (!data) return false
  if (data.topic.id !== '__all__') return false
  const domains = new Set(data.nodes.map((n) => n.domain ?? '未分类'))
  return domains.size > 1
}

// ============================================================
// 数据转换
// ============================================================
function buildG6Data(data: GraphData) {
  const useDomainLayout = needsDomainGrouping(data)

  const edges = data.edges.map((e) => ({
    id: edgeId(e),
    source: e.source,
    target: e.target,
    data: e,
  }))

  if (useDomainLayout) {
    const baseNodes = data.nodes.map((n) => ({ id: n.id, data: n }))
    const layoutPositions = computeDomainLayout(baseNodes, edges)

    const nodes = data.nodes.map((n) => {
      const pos = layoutPositions.get(n.id) ?? { x: 0, y: 0 }
      return {
        id: n.id,
        data: n,
        style: {
          x: pos.x,
          y: pos.y,
        },
      }
    })

    return { nodes, edges }
  }

  const nodes = data.nodes.map((n) => ({
    id: n.id,
    data: n,
  }))
  return { nodes, edges }
}

function lighten(hex: string, ratio: number): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)

  const nr = Math.round(r + (255 - r) * ratio)
  const ng = Math.round(g + (255 - g) * ratio)
  const nb = Math.round(b + (255 - b) * ratio)

  return `rgb(${nr}, ${ng}, ${nb})`
}

function computeNodeStyle(
  n: GraphNode,
  hasChildren: boolean,
  selectedId: string | null,
  neighbors: Set<string>,
) {
  const isSelected = selectedId === n.id
  const isNeighbor = selectedId !== null && neighbors.has(n.id) && !isSelected
  const isInactive = selectedId !== null && !isSelected && !isNeighbor

  // ---- root 星 ----
  if (hasChildren) {
    const descendants = descendantCountCache.value.get(n.id) ?? 0
    const size = Math.min(100, 56 + Math.sqrt(descendants) * 10)

    const rootShadowColor = isSelected
      ? HIGHLIGHT_PRIMARY
      : isNeighbor
        ? HIGHLIGHT_SECONDARY
        : '#f59e0b'

    return {
      size,
      // ★ 轻微提亮，避免纯色死板
      fill: lighten('#fbbf24', 0.08),
      fillOpacity: 1,

      stroke: isSelected
        ? HIGHLIGHT_PRIMARY
        : isNeighbor
          ? HIGHLIGHT_SECONDARY
          : 'rgba(255, 255, 255, 0.9)',
      lineWidth: isSelected ? 2 : 1,

      shadowColor: rootShadowColor,
      shadowBlur: isSelected ? 24 : isNeighbor ? 18 : 14,
      shadowOffsetX: 0,
      shadowOffsetY: 2,
      shadowOpacity: isSelected ? 1 : isNeighbor ? 0.75 : 0.55,

      opacity: isInactive ? 0.25 : 1,
      labelText: n.name,
      labelPlacement: 'bottom',
      labelOffsetY: size / 2 + 10,
      labelFill: '#92400e',
      labelFontSize: 13,
      labelFontWeight: 700,
      labelBackground: true,
      labelBackgroundFill: 'rgba(255, 251, 235, 0.95)',
      labelBackgroundPadding: [3, 8],
      labelBackgroundRadius: 4,
      labelBackgroundStroke: 'rgba(245, 158, 11, 0.4)',
      labelBackgroundLineWidth: 1,
      cursor: 'pointer',
      innerR: size * 0.38,
    }
  }

  // ---- 叶子矩形 ----
  const baseDomainColor = getDomainColor(n.domain)
  const baseStroke = STATUS_STROKE[n.status]

  // ★ 提亮 8%——色相不变，但没那么饱和死板
  const fill = lighten(baseDomainColor, 0.08)

  const textColor = pickTextColor(fill)

  const fontSize = n.level === 1 ? 12 : n.level === 2 ? 11 : 10
  const width = n.level === 1 ? 110 : n.level === 2 ? 100 : 90
  const height = n.level === 1 ? 34 : n.level === 2 ? 30 : 28
  const label = truncateText(n.name, width - 8, fontSize)

  const currentShadowColor = isSelected
    ? HIGHLIGHT_PRIMARY
    : isNeighbor
      ? HIGHLIGHT_SECONDARY
      : baseStroke

  return {
    size: [width, height] as [number, number],
    radius: 6,
    fill,
    fillOpacity: 1,

    stroke: isSelected
      ? HIGHLIGHT_PRIMARY
      : isNeighbor
        ? HIGHLIGHT_SECONDARY
        : 'rgba(255, 255, 255, 0.9)',
    lineWidth: isSelected ? 2 : 1,

    shadowColor: currentShadowColor,
    shadowBlur: isSelected ? 20 : isNeighbor ? 14 : 12,
    shadowOffsetX: 0,
    shadowOffsetY: 2,
    shadowOpacity: isSelected ? 1 : isNeighbor ? 0.75 : 0.5,

    opacity: isInactive ? 0.28 : 1,

    labelText: label,
    labelPlacement: 'center',
    labelFill: textColor,
    labelFontSize: fontSize,
    labelFontWeight: 500,
    labelBackground: false,
    labelShadowColor:
      textColor === '#ffffff'
        ? 'rgba(0, 0, 0, 0.5)'
        : 'rgba(255, 255, 255, 0.85)',
    labelShadowBlur: 2,
    labelShadowOffsetX: 0,
    labelShadowOffsetY: 0,
    cursor: 'pointer',
  }
}

// ============================================================
// 边样式
// ============================================================
function computeEdgeStyle(
  e: GraphEdge,
  selectedId: string | null,
  activeEdges: Set<string>,
) {
  if ((e.type as any) === DOMAIN_HUB_TYPE) {
    return {
      stroke: 'transparent',
      lineWidth: 0,
      opacity: 0,
      lineDash: [],
      endArrow: false,
      labelText: '',
    }
  }

  const color = EDGE_COLORS[e.type] ?? '#94a3b8'
  const curveOffset = CURVE_OFFSET[e.type] ?? 30
  const baseOpacity = e.type === 'parent' ? 0.55 : 0.15

  let lineWidth = 1
  let arrowSize = 4
  if (e.type === 'parent') {
    const sourceNode = props.data?.nodes.find((n) => n.id === e.source)
    const sourceLevel = sourceNode?.level ?? 0
    lineWidth = Math.max(1, 2 - sourceLevel * 0.5)
    arrowSize = 6
  }

  const id = edgeId(e)
  const isActive = selectedId !== null && activeEdges.has(id)
  const isInactive = selectedId !== null && !isActive

  return {
    stroke: isActive ? HIGHLIGHT_PRIMARY : color,
    lineWidth: isActive ? Math.max(2, lineWidth + 0.5) : lineWidth,
    lineDash: EDGE_LINE_DASH[e.type] ?? [],
    endArrow: true,
    endArrowSize: arrowSize,
    endArrowFill: isActive ? HIGHLIGHT_PRIMARY : color,
    labelText: '',
    curveOffset,
    opacity: isActive ? 1 : isInactive ? 0.08 : baseOpacity,
  }
}

// ============================================================
// 聚焦
// ============================================================
async function focusOnNode(nodeId: string) {
  if (!graph || !containerRef.value) return
  console.log('[focusOnNode] 开始聚焦:', nodeId)

  const focusElement = (graph as any).focusElement
  if (typeof focusElement === 'function') {
    try {
      await focusElement.call(graph, nodeId, true)
      return
    } catch (err) {
      console.warn('[focusOnNode] focusElement 失败，回退到 translateTo:', err)
    }
  }

  try {
    const node = graph.getNodeData(nodeId) as any
    if (!node) return

    const x = Number(node.style?.x ?? node.data?.x ?? node.x ?? 0)
    const y = Number(node.style?.y ?? node.data?.y ?? node.y ?? 0)
    const { clientWidth: w, clientHeight: h } = containerRef.value
    const zoom = Number((graph as any).getZoom?.() ?? 1)

    const tx = w / 2 - x * zoom
    const ty = h / 2 - y * zoom

    if (typeof (graph as any).translateTo === 'function') {
      await (graph as any).translateTo([tx, ty], {
        duration: 600,
        easing: 'ease-in-out',
      })
    } else if (typeof (graph as any).translate === 'function') {
      ;(graph as any).translate(tx, ty)
    }
  } catch (err) {
    console.warn('[focusOnNode] translateTo 失败:', err)
  }
}

// ============================================================
// 初始化图
// ============================================================
function initGraph() {
  if (!containerRef.value) return

  const useDomainLayout = needsDomainGrouping(props.data)

  graph = new Graph({
    container: containerRef.value,
    devicePixelRatio: window.devicePixelRatio || 2,
    autoFit: undefined,
    padding: 60,
    background: BG_COLOR,
    data: { nodes: [], edges: [] },

    layout: useDomainLayout
      ? {
          type: 'd3-force',
          link: {
            distance: (d: any) => {
              const e = d.data as GraphEdge
              return e?.type === 'parent' ? 100 : 200
            },
            strength: (d: any) => {
              const e = d.data as GraphEdge
              return e?.type === 'parent' ? 0.9 : 0.02
            },
          },
          manyBody: { strength: -250 },
          collide: {
            radius: (d: any) => {
              const n = d?.data ?? d
              if (!n) return 40
              const hasChildren = (descendantCountCache.value.get(n.id) ?? 0) > 0
              if (hasChildren) return 45
              const width = n.level === 1 ? 110 : n.level === 2 ? 100 : 90
              return width / 2 + 6
            },
            strength: 1,
          },
          alphaTarget: 0.001,
          alphaDecay: 0.05,
          alphaMin: 0.0001,
          center: { x: 0, y: 0, strength: 0.001 },
          animated: true,
        }
      : {
          type: 'd3-force',
          link: {
            distance: (d: any) => {
              const e = d.data as GraphEdge
              if ((e?.type as any) === DOMAIN_HUB_TYPE) return 180
              return e?.type === 'parent' ? 120 : 240
            },
            strength: (d: any) => {
              const e = d.data as GraphEdge
              if ((e?.type as any) === DOMAIN_HUB_TYPE) return 0.25
              return e?.type === 'parent' ? 0.9 : 0.05
            },
          },
          manyBody: { strength: -400 },
          collide: {
            radius: (d: any) => {
              const n = d?.data ?? d
              if (!n) return 50
              const hasChildren = (descendantCountCache.value.get(n.id) ?? 0) > 0
              if (hasChildren) return 50
              const width = n.level === 1 ? 110 : n.level === 2 ? 100 : 90
              return width / 2 + 10
            },
            strength: 1,
          },
          center: { x: 0, y: 0, strength: 0.03 },
          animated: true,
        },

    node: {
      type: (d: any) => {
        const n = d.data as GraphNode
        const hasChildren = (descendantCountCache.value.get(n.id) ?? 0) > 0
        return hasChildren ? 'star' : 'rect'
      },
      style: (d: any) => {
        const n = d.data as GraphNode
        const hasChildren = (descendantCountCache.value.get(n.id) ?? 0) > 0
        return computeNodeStyle(
          n,
          hasChildren,
          currentSelectedId.value,
          neighborIdSet.value,
        )
      },
    },

    edge: {
      type: 'quadratic',
      style: (d: any) => {
        const e = d.data as GraphEdge
        return computeEdgeStyle(
          e,
          currentSelectedId.value,
          activeEdgeIdSet.value,
        )
      },
    },

    behaviors: ['zoom-canvas', 'drag-canvas', 'drag-element-force'],
  })

  graph.on('node:click', (e: any) => {
    const nodeId = e.target?.id
    if (nodeId) {
      emit('select-node', nodeId)
      emit('open-detail', nodeId)
    }
  })

  graph.on('canvas:click', () => {
    emit('select-node', null)
  })
}

// ============================================================
// 数据更新
// ============================================================
watch(
  () => props.data,
  (newData, oldData) => {
    if (!graph) return

    const newGrouping = needsDomainGrouping(newData)
    const oldGrouping = needsDomainGrouping(oldData)

    if (newGrouping !== oldGrouping) {
      graph.destroy()
      graph = null

      if (newData && newData.nodes.length > 0) {
        descendantCountCache.value = computeDescendantCounts(newData.nodes)
      } else {
        descendantCountCache.value = new Map()
      }

      initGraph()

      if (newData && newData.nodes.length > 0) {
        graph!.setData(buildG6Data(newData))
        graph!.render()
      }

      currentSelectedId.value = null
      emit('select-node', null)
      return
    }

    if (newData && newData.nodes.length > 0) {
      descendantCountCache.value = computeDescendantCounts(newData.nodes)
    } else {
      descendantCountCache.value = new Map()
    }

    if (!newData || newData.nodes.length === 0) {
      graph.setData({ nodes: [], edges: [] })
      graph.render()
      currentSelectedId.value = null
      emit('select-node', null)
      return
    }

    graph.setData(buildG6Data(newData))
    graph.render()
    currentSelectedId.value = null
    emit('select-node', null)
  },
  { deep: false },
)

// ============================================================
// 选中变化
// ============================================================
watch(
  () => props.selectedNodeId,
  (nodeId) => {
    currentSelectedId.value = nodeId

    if (!graph || !props.data) return

    const nodeUpdates = props.data.nodes.map((n) => {
      const hasChildren = (descendantCountCache.value.get(n.id) ?? 0) > 0
      const style = computeNodeStyle(
        n,
        hasChildren,
        nodeId,
        neighborIdSet.value,
      )
      return { id: n.id, style }
    })

    const edgeUpdates = props.data.edges.map((e) => {
      const style = computeEdgeStyle(e, nodeId, activeEdgeIdSet.value)
      return { id: edgeId(e), style }
    })

    try {
      graph.updateNodeData(nodeUpdates)
      graph.updateEdgeData(edgeUpdates)
      graph.draw()
    } catch (err) {
      console.warn('[GraphCanvas] updateElementData failed:', err)
    }
  },
  { immediate: true },
)

// ============================================================
// 生命周期
// ============================================================
onMounted(() => {
  requestAnimationFrame(() => {
    initGraph()

    if (props.data && props.data.nodes.length > 0) {
      descendantCountCache.value = computeDescendantCounts(props.data.nodes)
      graph!.setData(buildG6Data(props.data))
      graph!.render()
    }

    if (containerRef.value) {
      resizeObserver = new ResizeObserver(() => {
        if (!graph) return
        cancelAnimationFrame(resizeRaf)
        resizeRaf = requestAnimationFrame(() => {
          try {
            graph!.resize()
            if (!currentSelectedId.value) {
              graph!.fitView()
            }
          } catch {}
        })
      })
      resizeObserver.observe(containerRef.value)
    }
  })
})

onBeforeUnmount(() => {
  if (resizeObserver) {
    resizeObserver.disconnect()
    resizeObserver = null
  }
  cancelAnimationFrame(resizeRaf)
  graph?.destroy()
  graph = null
})

defineExpose({
  fitView() {
    graph?.fitView()
  },
  focusOnNode,
})
</script>

<template>
  <div ref="containerRef" class="graph-canvas" />
</template>

<style scoped lang="scss">
.graph-canvas {
  width: 100%;
  height: 100%;
  background: #fafafa;
  position: relative;

  /* 极淡点阵背景 */
  background-image: radial-gradient(
    circle,
    rgba(15, 23, 42, 0.06) 1px,
    transparent 1px
  );
  background-size: 20px 20px;
}
</style>