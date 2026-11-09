<script setup lang="ts">
import { computed } from 'vue'
import type {
  GraphNode,
  GraphData,
  GraphEdgeType,
  GraphNodeStatus,
  Verdict,
} from '@/api/graph'

const props = defineProps<{
  node: GraphNode | null
  data: GraphData | null
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'navigate', nodeId: string): void
  (e: 'practice', nodeId: string): void
}>()

// ============================================================
// 文案映射
// ============================================================
const statusText: Record<GraphNodeStatus, string> = {
  'not-started': '未开始',
  learning: '学习中',
  proficient: '较熟练',
  mastered: '已掌握',
}

const statusTagType: Record<GraphNodeStatus, string> = {
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

const edgeTypeText: Record<GraphEdgeType, string> = {
  parent: '包含',
  causes: '导致',
  applies_to: '适用于',
  contrast: '对比',
  example_of: '示例',
  part_of: '属于',
}

// ============================================================
// 关联列表
// ============================================================
interface RelationItem {
  direction: 'out' | 'in'
  type: GraphEdgeType
  otherId: string
  otherName: string
  otherStatus: GraphNodeStatus | null
}

const relations = computed<RelationItem[]>(() => {
  if (!props.node || !props.data) return []
  const nodeId = props.node.id
  const nodeMap = new Map(props.data.nodes.map((n) => [n.id, n]))
  const list: RelationItem[] = []

  for (const e of props.data.edges) {
    if (e.source === nodeId) {
      const other = nodeMap.get(e.target)
      list.push({
        direction: 'out',
        type: e.type,
        otherId: e.target,
        otherName: other?.name ?? '?',
        otherStatus: other?.status ?? null,
      })
    } else if (e.target === nodeId) {
      const other = nodeMap.get(e.source)
      list.push({
        direction: 'in',
        type: e.type,
        otherId: e.source,
        otherName: other?.name ?? '?',
        otherStatus: other?.status ?? null,
      })
    }
  }
  return list
})

// ============================================================
// 掌握度百分比
// ============================================================
const percentage = computed(() =>
  props.node ? Math.round(props.node.masteryScore * 100) : 0,
)

const accuracyText = computed(() => {
  if (!props.node) return ''
  const { correctAttempts, totalAttempts } = props.node
  if (totalAttempts === 0) return '未答过'
  return `答过 ${totalAttempts} 次 · 对 ${correctAttempts} 次`
})
</script>

<template>
  <!-- ========== 空状态 ========== -->
  <div v-if="!node" class="empty-panel">
    <div class="empty-icon">👆</div>
    <div class="empty-title">点击画布中的节点</div>
    <div class="empty-sub">查看概念详情与掌握度</div>
  </div>

  <!-- ========== 详情 ========== -->
  <div v-else class="detail-panel">
    <!-- 头部：标题 + 关闭 -->
    <div class="panel-header">
      <h3 class="node-name" :title="node.name">{{ node.name }}</h3>
      <el-button link size="small" @click="emit('close')">
        <span class="close-icon">✕</span>
      </el-button>
    </div>

    <!-- 状态标签 + 百分比 -->
    <div class="status-row">
      <el-tag :type="statusTagType[node.status] as any" size="small">
        {{ statusText[node.status] }}
      </el-tag>
      <span class="percent">{{ percentage }}%</span>
    </div>

    <!-- 掌握度进度条 -->
    <el-progress
      :percentage="percentage"
      :status="node.masteryScore >= 0.8 ? 'success' : undefined"
      :stroke-width="8"
      :show-text="false"
      class="progress"
    />

    <!-- 答题统计 -->
    <div class="stat-line">
      {{ accuracyText }}
      <span v-if="node.lastVerdict" class="stat-verdict">
        · 最近 {{ verdictText[node.lastVerdict] }}
      </span>
    </div>

    <!-- 定义 -->
    <div v-if="node.definition" class="section">
      <div class="section-title">定义</div>
      <div class="definition">{{ node.definition }}</div>
    </div>

    <!-- 关联概念 -->
    <div v-if="relations.length > 0" class="section">
      <div class="section-title">
        关联概念
        <span class="relation-count">({{ relations.length }})</span>
      </div>
      <div class="relation-list">
        <div
          v-for="(r, i) in relations"
          :key="i"
          class="relation-item"
          @click="emit('navigate', r.otherId)"
        >
          <span class="arrow">{{ r.direction === 'out' ? '→' : '←' }}</span>
          <el-tag size="small" type="info" effect="plain" class="type-tag">
            {{ edgeTypeText[r.type] }}
          </el-tag>
          <span class="other-name" :title="r.otherName">
            {{ r.otherName }}
          </span>
          <span
            v-if="r.otherStatus"
            class="status-dot"
            :class="`dot-${r.otherStatus}`"
          ></span>
        </div>
      </div>
    </div>

    <div v-else class="section">
      <div class="section-title">关联概念</div>
      <div class="no-relation">暂无关联</div>
    </div>

    <!-- 叶子提示（可出题） -->
    <div v-if="node.isLeaf" class="leaf-hint">
      💡 这是一个可独立出题的概念
    </div>
    <div v-else class="leaf-hint non-leaf">
      这是一个综合概念，包含 {{ '多个' }} 子概念
    </div>

    <!-- 底部操作 -->
    <div class="actions">
      <el-button
        v-if="node.isLeaf"
        type="primary"
        size="default"
        class="practice-btn"
        @click="emit('practice', node.id)"
      >
        练习这个概念
      </el-button>
      <el-tooltip
        v-else
        content="综合概念不直接出题，请练习其子概念"
        placement="top"
      >
        <el-button
          type="primary"
          size="default"
          class="practice-btn"
          disabled
        >
          练习这个概念
        </el-button>
      </el-tooltip>
    </div>
  </div>
</template>

<style scoped lang="scss">
/* ============================================================
 * 空状态
 * ============================================================ */
.empty-panel {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #bfbfbf;
  padding: 24px;
}
.empty-icon {
  font-size: 40px;
  margin-bottom: 16px;
  opacity: 0.5;
}
.empty-title {
  font-size: 14px;
  color: #8c8c8c;
  margin-bottom: 6px;
}
.empty-sub {
  font-size: 12px;
  color: #bfbfbf;
}

/* ============================================================
 * 详情面板
 * ============================================================ */
.detail-panel {
  width: 100%;
  height: 100%;
  padding: 20px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
}

/* 头部 */
.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 12px;
  gap: 8px;
}
.node-name {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: #262626;
  word-break: break-word;
  line-height: 1.4;
  flex: 1;
}
.close-icon {
  font-size: 14px;
  color: #8c8c8c;
}

/* 状态行 */
.status-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}
.percent {
  font-size: 18px;
  font-weight: 700;
  color: #262626;
}

/* 进度条 */
.progress {
  margin-bottom: 8px;
}

/* 统计 */
.stat-line {
  font-size: 12px;
  color: #8c8c8c;
  margin-bottom: 20px;
}
.stat-verdict {
  color: #8c8c8c;
}

/* 通用 section */
.section {
  margin-bottom: 20px;
}
.section-title {
  font-size: 13px;
  font-weight: 600;
  color: #595959;
  margin-bottom: 8px;
  display: flex;
  align-items: baseline;
  gap: 4px;
}
.relation-count {
  font-weight: 400;
  font-size: 12px;
  color: #bfbfbf;
}

/* 定义 */
.definition {
  font-size: 13px;
  color: #595959;
  line-height: 1.7;
  padding: 12px;
  background: #fafafa;
  border-radius: 6px;
  white-space: pre-wrap;
}

/* 关联列表 */
.relation-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.relation-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  padding: 8px 10px;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.2s;
  border: 1px solid transparent;
}
.relation-item:hover {
  background: #f5f8ff;
  border-color: #e6f0ff;
}
.arrow {
  color: #bfbfbf;
  font-size: 14px;
  flex-shrink: 0;
}
.type-tag {
  flex-shrink: 0;
}
.other-name {
  color: #262626;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}
.dot-not-started { background: #d9d9d9; }
.dot-learning { background: #ff7a45; }
.dot-proficient { background: #40a9ff; }
.dot-mastered { background: #52c41a; }

/* 无关联 */
.no-relation {
  font-size: 12px;
  color: #bfbfbf;
  padding: 8px 12px;
  background: #fafafa;
  border-radius: 6px;
}

/* 叶子提示 */
.leaf-hint {
  font-size: 12px;
  color: #8c8c8c;
  padding: 10px 12px;
  background: #f0f7ff;
  border-radius: 6px;
  border-left: 3px solid #40a9ff;
  margin-bottom: 20px;
  line-height: 1.6;
}
.leaf-hint.non-leaf {
  background: #fffbe6;
  border-left-color: #faad14;
}

/* 操作区 */
.actions {
  margin-top: auto;
  padding-top: 16px;
  border-top: 1px solid #f0f0f0;
}
.practice-btn {
  width: 100%;
}
</style>