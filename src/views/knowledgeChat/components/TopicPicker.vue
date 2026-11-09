<template>
  <div class="topic-picker">
    <div class="topic-picker-title">选择一个主题开始练习：</div>
    <div class="topic-grid">
      <div
        v-for="t in topics"
        :key="t.id"
        class="topic-card"
        :class="{ disabled }"
        @click="!disabled && emit('pick', t)"
      >
        <div class="topic-name">{{ t.name }}</div>
        <div class="topic-count">{{ t.nodeCount }} 个知识点</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Topic } from '@/api/knowledge'

defineProps<{
  topics: Topic[]
  disabled: boolean
}>()

const emit = defineEmits<{
  pick: [topic: Topic]
}>()
</script>

<style scoped lang="scss">
.topic-picker {
  background: var(--ds-bg-panel);
  border: 1px solid var(--ds-border-subtle);
  border-radius: var(--ds-radius-lg);
  padding: 20px;
  margin-bottom: 24px;
  box-shadow: var(--ds-shadow-panel);
}

.topic-picker-title {
  font-size: 14px;
  color: var(--ds-text-secondary);
  margin-bottom: 16px;
}

.topic-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 12px;
}

.topic-card {
  padding: 14px 16px;
  border: 1px solid var(--ds-border-default);
  border-radius: var(--ds-radius-md);
  cursor: pointer;
  transition: all 0.15s;
  background: var(--ds-bg-page);

  &:hover:not(.disabled) {
    border-color: var(--ds-brand);
    background: var(--ds-brand-hover);
    transform: translateY(-1px);
  }

  &.disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }

  .topic-name {
    font-size: 15px;
    font-weight: 500;
    color: var(--ds-text-primary);
    margin-bottom: 4px;
  }

  .topic-count {
    font-size: 12px;
    color: var(--ds-text-tertiary);
  }
}
</style>