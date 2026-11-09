<template>
  <div class="knowledge-app app-frame">
    <AppSidebar
      :modes="chat.modes.value"
      :active-mode="chat.currentModeId.value"
      :collapsed="collapsed"
      :sessions="chat.sessionList.value"
      :current-session-id="chat.sessionId.value"
      @toggle="collapsed = !collapsed"
      @switch-mode="onSwitchMode"
      @switch-session="onSwitchSession"
      @new-session="onNewSession"
    />

    <main class="conversation-column">
      <ConversationHeader :state-label="chat.stateLabel.value" />

      <div v-if="chat.restoring.value" class="restore-hint">
        正在恢复对话...
      </div>

      <MessageList
        :messages="chat.messages.value"
        :loading="chat.loading.value"
        :countdown-visible="chat.countdownVisible.value"
        :countdown-remaining="chat.countdownRemaining.value"
        :countdown-paused="chat.countdownPaused.value"
        @resend="chat.resendMessage"
        @card-action="chat.dispatchCardAction"
        @pause-countdown="chat.pauseCountdown"
        @resume-countdown="chat.resumeCountdown"
        @next-question="chat.nextQuestionNow"
      >
        <template #extra>
          <div v-if="chat.restoring.value" class="restoring-block">
            <el-icon class="is-loading"><Loading /></el-icon>
            <span>加载历史记录中...</span>
          </div>
        </template>
      </MessageList>

      <ChatComposer
        v-model="chat.input.value"
        :disabled="!chat.canInput.value || chat.restoring.value"
        :loading="chat.loading.value"
        :can-skip="chat.canSkip.value"
        @send="chat.sendMessage"
        @skip="chat.skip"
      />
    </main>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Loading } from '@element-plus/icons-vue'
import { MODES } from '@/api/knowledge'
import type { ChatModeId } from '@/api/knowledge'
import { useKnowledgeChat } from '@/views/knowledgeChat/composables/useKnowledgeChat'
import AppSidebar from '@/views/knowledgeChat/components/AppSidebar.vue'
import ConversationHeader from '@/views/knowledgeChat/components/ConversationHeader.vue'
import MessageList from '@/views/knowledgeChat/components/MessageList.vue'
import ChatComposer from '@/views/knowledgeChat/components/ChatComposer.vue'

const chat = useKnowledgeChat()
const collapsed = ref(false)

const route = useRoute()
const router = useRouter()

const DEFAULT_MODE: ChatModeId = 'topic-practice'

// ============================================================
// 路由参数解析
// ============================================================

function getRouteModeId(): ChatModeId | undefined {
  const raw = route.params.modeId
  const s = Array.isArray(raw) ? raw[0] : raw
  if (!s) return undefined
  return MODES.some((m) => m.id === s) ? (s as ChatModeId) : undefined
}

function getRouteSessionId(): string | undefined {
  const raw = route.params.sessionId
  if (Array.isArray(raw)) return raw[0] || undefined
  return raw || undefined
}

// URL 上没 modeId 时补成默认值；返回 false 表示已触发 replace
function ensureModeInUrl(): boolean {
  if (getRouteModeId()) return true
  router.replace({ name: 'chat', params: { modeId: DEFAULT_MODE } })
  return false
}

// 从会话列表里取该模式下「最新」的一条
// 优先用 updatedAt/createdAt 排序，字段缺失时退回原顺序
function findLatestSessionForMode(mode: ChatModeId) {
  const candidates = chat.sessionList.value.filter(
    (s) => (s.stateMachineId ?? DEFAULT_MODE) === mode,
  )
  if (candidates.length <= 1) return candidates[0]

  return candidates.slice().sort((a: any, b: any) => {
    const ta = a.updatedAt ?? a.createdAt ?? ''
    const tb = b.updatedAt ?? b.createdAt ?? ''
    if (ta && tb) return tb.localeCompare(ta)
    return 0
  })[0]
}

// ============================================================
// 核心：根据 URL 恢复 / 复用最新 / 新建
// ------------------------------------------------------------
// 1. 有 sessionId        → 恢复它
// 2. 无 sessionId 但有历史 → 恢复该模式最新的一条
// 3. 都没有              → 新建
// ============================================================

let resolveSeq = 0

async function resolveFromRoute() {
  const mySeq = ++resolveSeq

  const modeId = getRouteModeId()
  const sidFromRoute = getRouteSessionId()

  // ---- 1. 有 sessionId：尝试恢复 ----
  if (sidFromRoute) {
    // 已经是当前会话 → 不重复恢复
    if (sidFromRoute === chat.sessionId.value) return

    const ok = await chat.resumeSession(sidFromRoute)
    if (mySeq !== resolveSeq) return // 已有更新的路由变更

    if (ok) {
      // 以 session 实际的 stateMachineId 为准，修正 URL
      const actualMode = chat.currentModeId.value
      if (actualMode !== modeId) {
        router.replace({
          name: 'chat',
          params: { modeId: actualMode, sessionId: sidFromRoute },
        })
      }
      return
    }

    // 恢复失败 → 落到下面尝试最新 / 新建
    console.warn('[resolve] resume failed, fallback to latest/new')
  }

  // ---- 2. 无 sessionId（或恢复失败）：先尝试复用该模式最新会话 ----
  const effectiveMode: ChatModeId = modeId ?? DEFAULT_MODE
  const latest = findLatestSessionForMode(effectiveMode)

  if (latest && latest.id !== chat.sessionId.value) {
    const ok = await chat.resumeSession(latest.id)
    if (mySeq !== resolveSeq) return

    if (ok) {
      router.replace({
        name: 'chat',
        params: { modeId: effectiveMode, sessionId: latest.id },
      })
      return
    }

    console.warn('[resolve] resume latest failed, fallback to new session')
  }

  // ---- 3. 兜底：新建 ----
  const created = await chat.startNewSession(effectiveMode)
  if (mySeq !== resolveSeq) return

  if (created && chat.sessionId.value) {
    router.replace({
      name: 'chat',
      params: { modeId: effectiveMode, sessionId: chat.sessionId.value },
    })
  }
}

// ============================================================
// 生命周期
// ============================================================

onMounted(async () => {
  await chat.bootstrap()

  // 部分实现里 bootstrap 不拉列表，这里补一手，保证 findLatestSessionForMode 有效
  if (chat.sessionList.value.length === 0) {
    await chat.refreshSessionList?.()
  }

  // 无 modeId → 重定向到默认场景（replace 会触发 watch）
  if (!ensureModeInUrl()) return

  await resolveFromRoute()
})

// 监听路由变化：支持浏览器前进/后退 + 侧边栏切换
watch(
  () => [route.params.modeId, route.params.sessionId] as const,
  ([newMode, newSid], [oldMode, oldSid]) => {
    if (newMode === oldMode && newSid === oldSid) return
    if (!ensureModeInUrl()) return
    resolveFromRoute()
  },
)

// ============================================================
// 交互入口（改 URL → watch 触发 resolve）
// ============================================================

async function onSwitchMode(modeId: ChatModeId) {
  if (modeId === chat.currentModeId.value && chat.hasMessages.value) {
    // 同一场景：确认后新建会话
    const ok = await chat.switchMode(modeId)
    if (ok && chat.sessionId.value) {
      router.replace({
        name: 'chat',
        params: { modeId, sessionId: chat.sessionId.value },
      })
    }
    return
  }

  // 不同场景：只改 URL，让 resolveFromRoute 走「复用最新 / 新建」流程
  router.push({ name: 'chat', params: { modeId } })
}

async function onSwitchSession(id: string) {
  if (id === chat.sessionId.value) return

  const target = chat.sessionList.value.find((s) => s.id === id)
  const targetMode: ChatModeId =
    (target?.stateMachineId as ChatModeId | undefined) ??
    chat.currentModeId.value

  const ok = await chat.switchSession(id)
  if (ok) {
    router.push({
      name: 'chat',
      params: { modeId: targetMode, sessionId: id },
    })
  }
}

async function onNewSession() {
  const ok = await chat.newSession()
  if (ok && chat.sessionId.value) {
    router.push({
      name: 'chat',
      params: {
        modeId: chat.currentModeId.value,
        sessionId: chat.sessionId.value,
      },
    })
  }
}
</script>

<style scoped lang="scss">
.app-frame {
  display: flex;
  height: 100vh;
  background: var(--ds-bg-page);
  font-family: system-ui, -apple-system, 'Segoe UI', sans-serif;
  color: var(--ds-text-primary);
}

.conversation-column {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  background: var(--ds-bg-panel);
  height: 100vh;
  position: relative;
}

.restore-hint {
  padding: 8px 16px;
  font-size: 12px;
  color: var(--ds-text-tertiary, #999);
  text-align: center;
  border-bottom: 1px dashed var(--ds-border-subtle, #ebeef5);
}

.restoring-block {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 16px;
  color: var(--ds-text-tertiary, #999);
  font-size: 13px;
}
</style>