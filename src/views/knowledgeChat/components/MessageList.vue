<template>
  <div ref="scrollRef" class="conv-body">
    <div class="conv-inner">
      <template v-for="msg in messages" :key="msg.id">
        <CardMessage
          v-if="msg.type === 'card'"
          :message="msg"
          :disabled="loading"
          @action="(ev) => onCardAction(msg, ev)"
        />

        <MessageItem
          v-else
          :message="msg"
          :show-countdown="msg.id === latestJudgementId && countdownVisible"
          :countdown-remaining="countdownRemaining"
          :countdown-paused="countdownPaused"
          @resend="emit('resend', $event)"
          @pause-countdown="emit('pause-countdown')"
          @resume-countdown="emit('resume-countdown')"
          @next-question="emit('next-question')"
        />
      </template>

      <div v-if="showThinking" class="thinking">
        <el-icon class="is-loading"><Loading /></el-icon>
        <span>思考中...</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { Loading } from '@element-plus/icons-vue'
import type { ChatMessage } from '@/api/knowledge'
import MessageItem from './MessageItem.vue'
import CardMessage from './CardMessage.vue'

const props = defineProps<{
  messages: ChatMessage[]
  loading: boolean
  // ★ 新增：倒计时状态
  countdownVisible: boolean
  countdownRemaining: number
  countdownPaused: boolean
}>()

const emit = defineEmits<{
  resend: [message: ChatMessage]
  'card-action': [
    payload: {
      cardMessageId: string
      actionName: string
      payload?: unknown
      toolCallId?: string
    },
  ]
  // ★ 新增
  'pause-countdown': []
  'resume-countdown': []
  'next-question': []
}>()

const scrollRef = ref<HTMLElement>()

const showThinking = computed(
  () => props.loading && !props.messages.some((m) => m._streaming),
)

// ★ 找最新一条 judgement 消息的 id（倒计时只挂在这条上）
const latestJudgementId = computed<string | null>(() => {
  for (let i = props.messages.length - 1; i >= 0; i--) {
    const m = props.messages[i]
    if (m.type === 'judgement' || m.type === 'end') {   // ★ 加 end
      return m.id
    }
  }
  return null
})

function onCardAction(
  msg: ChatMessage,
  ev: { name: string; payload?: unknown },
) {
  emit('card-action', {
    cardMessageId: msg.id,
    actionName: ev.name,
    payload: ev.payload,
    toolCallId: msg.payload?.toolCallId,
  })
}

function scrollToBottom() {
  nextTick(() => {
    const el = scrollRef.value
    if (!el) return
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight
    if (distance < 120) el.scrollTop = el.scrollHeight
  })
}

watch(
  () => [
    props.messages.length,
    props.messages.map((m) => m.content.length).join(','),
    props.loading,
  ],
  () => scrollToBottom(),
  { immediate: true },
)
</script>

<style scoped lang="scss">
.conv-body {
  padding: 66px 40px 0px 40px;
  height: calc(100vh - 110px);
  overflow-y: auto;
}
.thinking {
  margin-bottom: 26px;
}
/* 保持你原有样式 */
</style>