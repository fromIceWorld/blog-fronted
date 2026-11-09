<template>
  <div class="topic-picker-body">
    <!-- 空态 -->
    <div v-if="topics.length === 0" class="empty-hint">
      暂无可选主题，请刷新页面重试
    </div>

    <!-- 按 domain 分组 -->
    <div v-else class="domain-groups">
      <div
        v-for="group in groupedTopics"
        :key="group.domain"
        class="domain-group"
      >
        <div class="domain-title">
          <span>{{ group.domain }}</span>
          <span class="domain-count">{{ group.topics.length }} 个主题</span>
        </div>

        <div class="topic-list">
          <button
            v-for="t in visibleTopics(group.domain)"
            :key="t.id"
            class="topic-btn"
            :class="{ 'is-selected': selectedId === t.id }"
            :disabled="disabled || payload.status !== 'pending'"
            @click="pick(t)"
          >
            <el-icon v-if="selectedId === t.id" class="check-icon">
              <Check />
            </el-icon>
            <span class="topic-name">{{ t.name }}</span>
            <span class="topic-count">({{ t.nodeCount }})</span>
          </button>
        </div>

        <!-- 折叠更多 -->
        <button
          v-if="group.topics.length > INITIAL_SHOW"
          class="toggle-more-btn"
          @click="toggleExpand(group.domain)"
        >
          {{ isExpanded(group.domain)
            ? '收起'
            : `展开更多（还有 ${group.topics.length - INITIAL_SHOW} 个）` }}
        </button>
      </div>
    </div>

    <!-- 状态行 -->
    <div
      v-if="statusLine"
      class="card-status-line"
      :class="`line-${payload.status}`"
    >
      <el-icon v-if="payload.status === 'acting'" class="is-loading">
        <Loading />
      </el-icon>
      <el-icon v-else-if="payload.status === 'resolved'">
        <CircleCheckFilled />
      </el-icon>
      <span>{{ statusLine }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  Check,
  CircleCheckFilled,
  Loading,
} from '@element-plus/icons-vue'
import type { ChatMessage } from '@/api/knowledge'

const props = defineProps<{
  message: ChatMessage
  disabled: boolean
}>()

const emit = defineEmits<{
  action: [{ name: string; payload?: unknown }]
}>()

// 默认只显示前 N 个，点展开显示全部
const INITIAL_SHOW = 8

interface FlatTopic {
  id: string
  name: string
  nodeCount: number
  parentName: string
}

const payload = computed(() => props.message.payload!)

// 解析 topics
const topics = computed<FlatTopic[]>(() => {
  const list = (payload.value.data as any)?.topics ?? []
  return Array.isArray(list) ? (list as FlatTopic[]) : []
})

// 按 domain 分组 + 组内按 nodeCount 降序
const groupedTopics = computed(() => {
  const groups = new Map<string, FlatTopic[]>()

  for (const t of topics.value) {
    const domain = t.parentName ?? '其他'
    if (!groups.has(domain)) groups.set(domain, [])
    groups.get(domain)!.push(t)
  }

  // domain 固定顺序：CSS → HTML → JS → 其他
  const order = ['CSS', 'HTML', 'JS']
  return [...groups.entries()]
    .sort(([a], [b]) => {
      const ai = order.indexOf(a)
      const bi = order.indexOf(b)
      if (ai === -1 && bi === -1) return a.localeCompare(b)
      if (ai === -1) return 1
      if (bi === -1) return -1
      return ai - bi
    })
    .map(([domain, list]) => ({
      domain,
      topics: list.sort((a, b) => b.nodeCount - a.nodeCount),
    }))
})

// 展开状态
const expandedDomains = ref<Record<string, boolean>>({})

function isExpanded(domain: string): boolean {
  return !!expandedDomains.value[domain]
}

function toggleExpand(domain: string) {
  expandedDomains.value[domain] = !expandedDomains.value[domain]
}

function visibleTopics(domain: string): FlatTopic[] {
  const group = groupedTopics.value.find((g) => g.domain === domain)
  if (!group) return []

  if (isExpanded(domain) || group.topics.length <= INITIAL_SHOW) {
    return group.topics
  }
  return group.topics.slice(0, INITIAL_SHOW)
}

// 当前选中的 topicId（从 resolvedPayload 里拿）
const selectedId = computed<string | null>(() => {
  const resolved = payload.value.resolvedPayload as any
  return resolved?.topicId ?? null
})

// 状态提示
const statusLine = computed(() => {
  const p = payload.value
  if (p.status === 'acting') return '正在提交...'
  if (p.status === 'resolved') {
    const name =
      topics.value.find((t) => t.id === selectedId.value)?.name ?? '已选择'
    return `已选择：${name}`
  }
  return ''
})

function pick(t: FlatTopic) {
  // ★ 传单个 topicId（不是 topicIds 数组）
  emit('action', {
    name: 'pick-topic',
    payload: { topicId: t.id },
  })
}
</script>

<style scoped lang="scss">
.topic-picker-body {
  padding: 4px 0;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.domain-groups {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.domain-group {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.domain-title {
  display: flex;
  align-items: baseline;
  gap: 8px;
  font-size: 12px;
  font-weight: 600;
  color: var(--ds-text-tertiary, #999);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding-bottom: 6px;
  border-bottom: 1px solid var(--ds-border-subtle, #ebeef5);
}

.domain-count {
  font-size: 11px;
  font-weight: 400;
  color: var(--ds-text-tertiary, #bbb);
  text-transform: none;
  letter-spacing: 0;
}

.topic-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.topic-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  border: 1px solid var(--ds-border, #dcdfe6);
  border-radius: 8px;
  background: var(--ds-bg-panel, #fff);
  color: var(--ds-text-primary);
  font-size: 14px;
  cursor: pointer;
  transition: all 0.15s ease;

  &:hover:not(:disabled) {
    border-color: var(--ds-brand, #409eff);
    color: var(--ds-brand, #409eff);
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.55;
  }

  &.is-selected {
    border-color: var(--ds-brand, #409eff);
    color: var(--ds-brand, #409eff);
    background: rgba(64, 158, 255, 0.06);
    opacity: 1;
  }
}

.check-icon {
  font-size: 14px;
}

.topic-name {
  white-space: nowrap;
}

.topic-count {
  font-size: 12px;
  color: var(--ds-text-tertiary, #999);
}

.toggle-more-btn {
  align-self: flex-start;
  background: transparent;
  border: none;
  padding: 4px 8px;
  font-size: 12px;
  color: var(--ds-brand, #409eff);
  cursor: pointer;
  border-radius: 4px;

  &:hover {
    background: rgba(64, 158, 255, 0.06);
  }
}

.empty-hint {
  color: var(--ds-text-tertiary, #999);
  font-size: 13px;
  padding: 8px 0;
}

.card-status-line {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  padding-top: 16px;
  border-top: 1px dashed var(--ds-border, #ebeef5);

  &.line-acting {
    color: var(--ds-brand, #409eff);
  }
  &.line-resolved {
    color: #67c23a;
  }
}
</style>