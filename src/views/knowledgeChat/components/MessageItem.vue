<template>
  <div class="msg-row" :class="message.role">
    <!-- ========== 用户消息 ========== -->
    <div v-if="message.role === 'user'" class="msg-user">
      <div v-if="message._status" class="msg-status">
        <el-icon
          v-if="message._status === 'sending'"
          class="is-loading status-icon sending"
        >
          <Loading />
        </el-icon>
        <el-icon
          v-else-if="message._status === 'sent'"
          class="status-icon sent"
        >
          <CircleCheckFilled />
        </el-icon>
        <el-icon
          v-else-if="message._status === 'failed'"
          class="status-icon failed"
        >
          <CircleCloseFilled />
        </el-icon>
      </div>

      <div class="user-bubble-wrap">
        <div v-if="message.type === 'action'" class="user-bubble action">
          {{ formatAction(message.content) }}
        </div>
        <div
          v-else
          class="user-bubble"
          :class="{ 'is-failed': message._status === 'failed' }"
        >
          {{ message.content }}
        </div>

        <div v-if="message._status === 'failed'" class="failed-hint">
          发送失败
          <el-button
            text
            size="small"
            type="primary"
            @click="emit('resend', message)"
          >
            重发
          </el-button>
        </div>
      </div>
    </div>

    <!-- ========== 系统消息 ========== -->
    <div v-else class="msg-assistant">
      <div v-if="label" class="assistant-label">
        <el-icon><component :is="label.icon" /></el-icon>
        <span>{{ label.text }}</span>
      </div>

      <div class="assistant-content">
        {{ message.content }}
        <span v-if="message._streaming" class="cursor-blink">▍</span>
      </div>

      <!-- ★ 倒计时工具条：整体一个浅色框，内部全内联 -->
      <div v-if="showCountdown" class="judgement-countdown">
        <span class="countdown-text">
          <template v-if="countdownPaused">
            已暂停
          </template>
          <template v-else>
            <span class="countdown-num">{{ countdownRemaining }}s</span>
            <span class="countdown-label">后自动下一题</span>
          </template>
        </span>

        <span class="divider" />

        <!-- 暂停 / 继续 -->
        <button
          class="icon-link"
          @click="
            countdownPaused
              ? emit('resume-countdown')
              : emit('pause-countdown')
          "
          :title="countdownPaused ? '继续倒计时' : '暂停倒计时'"
        >
          <el-icon>
            <component :is="countdownPaused ? VideoPlay : VideoPause" />
          </el-icon>
        </button>

        <!-- 下一题 -->
        <button
          class="text-link next"
          @click="emit('next-question')"
          title="立即进入下一题"
        >
          下一题
          <el-icon class="arrow"><ArrowRight /></el-icon>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import {
  ArrowRight,
  ChatDotRound,
  CircleCheckFilled,
  CircleCloseFilled,
  InfoFilled,
  Loading,
  QuestionFilled,
  VideoPause,
  VideoPlay,
} from '@element-plus/icons-vue'
import type { ChatMessage } from '@/api/knowledge'

const props = defineProps<{
  message: ChatMessage
  showCountdown?: boolean
  countdownRemaining?: number
  countdownPaused?: boolean
}>()

const emit = defineEmits<{
  resend: [message: ChatMessage]
  'pause-countdown': []
  'resume-countdown': []
  'next-question': []
}>()

const label = computed(() => {
  if (props.message.type === 'judgement') {
    return { icon: ChatDotRound, text: '点评' }
  }
  if (props.message.type === 'question') {
    return { icon: QuestionFilled, text: '提问' }
  }
  if (props.message.type === 'end') {
    return { icon: InfoFilled, text: '提示' }   // ★ 加这个
  }
  return null
})

const ACTION_LABELS: Record<string, string> = {
  'pick-topic': '选择了主题',
  skip: '跳过此题',
  exit: '结束练习',
  agree: '同意',
  challenge: '提出质疑',
}

function formatAction(content: string): string {
  const match = content.match(/^\[(.+)\]$/)
  if (!match) return content
  return ACTION_LABELS[match[1]] || content
}
</script>

<style scoped lang="scss">
.msg-row {
  display: flex;
  margin-bottom: 24px;

  &.user { justify-content: flex-end; }
  &.system { justify-content: flex-start; }
}

/* 用户消息 */
.msg-user {
  max-width: 80%;
  display: flex;
  align-items: flex-start;
  gap: 8px;
}

.msg-status {
  display: flex;
  align-items: center;
  padding-top: 12px;
  flex-shrink: 0;
}

.status-icon {
  font-size: 14px;

  &.sending { color: var(--ds-text-tertiary); }
  &.sent { color: #67c23a; }
  &.failed { color: #f56c6c; }
}

.user-bubble-wrap {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 4px;
  min-width: 0;
}

.user-bubble {
  padding: 12px 16px;
  background: var(--ds-brand);
  color: #fff;
  border-radius: 16px 16px 4px 16px;
  font-size: 15px;
  line-height: 1.6;
  word-break: break-word;
  white-space: pre-wrap;

  &.action {
    background: var(--ds-brand-light);
    color: var(--ds-brand);
    font-style: italic;
    font-size: 13px;
    padding: 6px 12px;
  }

  &.is-failed {
    background: rgba(245, 108, 108, 0.15);
    color: #f56c6c;
  }
}

.failed-hint {
  font-size: 12px;
  color: #f56c6c;
  padding-right: 4px;
  display: flex;
  align-items: center;
  gap: 4px;
}

/* 系统消息 */
.msg-assistant {
  max-width: 100%;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.assistant-label {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: var(--ds-text-tertiary);
  font-weight: 500;
}

.assistant-content {
  font-size: 15px;
  line-height: 1.8;
  color: var(--ds-text-primary);
  white-space: pre-wrap;
  word-break: break-word;
}

.cursor-blink {
  display: inline-block;
  animation: blink 1s step-end infinite;
  color: var(--ds-brand);
  margin-left: 2px;
}

@keyframes blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0; }
}
/* ★ 倒计时工具条 */
.judgement-countdown {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  margin-top: 10px;
  align-self: flex-start;
  animation: fade-in 0.2s ease;
}

/* ① 倒计时信息 */
.countdown-text {
  display: inline-flex;
  align-items: baseline;
  gap: 4px;
  font-size: 12px;
  color: var(--ds-text-tertiary, #999);
  font-variant-numeric: tabular-nums;

  &.paused {
    color: var(--ds-text-tertiary, #999);
    font-style: italic;
  }
}

.countdown-num {
  font-size: 13px;
  font-weight: 600;
  color: var(--ds-text-secondary, #666);
  font-variant-numeric: tabular-nums;
}

.countdown-label {
  font-size: 12px;
}

/* ★ 倒计时工具条：一个浅色框，内部全内联 */
.judgement-countdown {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin-top: 10px;
  padding: 5px 12px;
  background: var(--ds-bg-page, #f5f7fa);
  border-radius: 999px;
  font-size: 12px;
  color: var(--ds-text-tertiary, #999);
  align-self: flex-start;
  animation: fade-in 0.2s ease;
}

/* 倒计时文字 */
.countdown-text {
  display: inline-flex;
  align-items: baseline;
  gap: 3px;
  font-variant-numeric: tabular-nums;
}

.countdown-num {
  font-size: 13px;
  font-weight: 600;
  color: var(--ds-text-secondary, #666);
}

.countdown-label {
  font-size: 12px;
}

/* 分隔点 */
.divider {
  width: 1px;
  height: 12px;
  background: var(--ds-border, #dcdfe6);
}

/* 图标链接（暂停/继续） */
.icon-link {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  background: none;
  border: none;
  color: var(--ds-text-tertiary, #999);
  font-size: 13px;
  cursor: pointer;
  transition: color 0.15s ease;

  &:hover {
    color: var(--ds-text-secondary, #666);
  }
}

/* 下一题链接 */
.text-link {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 0;
  background: none;
  border: none;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: color 0.15s ease;

  &.next {
    color: var(--ds-brand, #409eff);

    .arrow {
      font-size: 11px;
      transition: transform 0.15s ease;
    }

    &:hover {
      color: var(--ds-brand-dark, #3a8ee6);

      .arrow {
        transform: translateX(2px);
      }
    }
  }
}

@keyframes fade-in {
  from {
    opacity: 0;
    transform: translateY(-4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>