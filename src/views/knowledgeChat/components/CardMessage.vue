<template>
  <div class="msg-row system">
    <div class="card-shell" :class="`status-${payload?.status ?? 'pending'}`">
      <div v-if="title" class="card-header">
        <span class="card-title">{{ title }}</span>
      </div>

      <div class="card-body">
        <component
          :is="renderer"
          v-if="renderer"
          :message="message"
          :disabled="disabled"
          @action="emit('action', $event)"
        />
        <div v-else class="unknown-card">
          不支持的卡片类型：{{ payload?.cardType }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, type Component } from 'vue'
import type { ChatMessage } from '@/api/knowledge'
import TopicPickerCard from './cards/TopicPickerCard.vue'

const props = defineProps<{
  message: ChatMessage
  disabled: boolean
}>()

const emit = defineEmits<{
  action: [{ name: string; payload?: unknown }]
}>()

const payload = computed(() => props.message.payload)

const title = computed(
  () => payload.value?.title ?? defaultTitle(payload.value?.cardType),
)

const renderer = computed<Component | null>(() => {
  const map: Record<string, Component> = {
    'topic-picker': TopicPickerCard,
  }
  return map[payload.value?.cardType ?? ''] ?? null
})

function defaultTitle(cardType?: string): string {
  const map: Record<string, string> = {
    'topic-picker': '请选择练习主题',
  }
  return cardType ? map[cardType] ?? '' : ''
}
</script>

<style scoped lang="scss">
.msg-row {
  display: flex;
  margin-bottom: 24px;

  &.system {
    justify-content: flex-start;
  }
}

.card-shell {
  max-width: 100%;
  min-width: 280px;
  padding: 16px;
  background: var(--ds-bg-panel, #fff);
  border: 1px solid var(--ds-border, #ebeef5);
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  transition: opacity 0.2s ease;

  &.status-acting {
    opacity: 0.9;
  }
  &.status-expired,
  &.status-cancelled {
    opacity: 0.6;
  }
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.card-title {
  font-size: 14px;
  font-weight: 500;
  color: var(--ds-text-primary);
}

.card-body {
  font-size: 14px;
  color: var(--ds-text-primary);
}

.unknown-card {
  color: var(--ds-text-tertiary, #999);
  font-size: 13px;
}
</style>