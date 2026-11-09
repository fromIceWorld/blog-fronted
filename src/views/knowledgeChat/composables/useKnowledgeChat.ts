import { computed, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { fetchEventSource } from '@microsoft/fetch-event-source'
import {
  createSession,
  getSessionDetail,
  getStreamUrl,
  listSessions,
  listTopics,
  MODES,
  saveMessage,
} from '@/api/knowledge'
import type {
  ChatMessage,
  ChatMode,
  ChatModeId,
  MessageStatus,
  MessageType,
  SessionEvent,
  SessionListItem,
  Topic,
} from '@/api/knowledge'

import { authStore } from '@/api/auth'
import { refreshAccessToken } from '@/api/auth'

// 兼容旧 import
export type { ChatMode, ChatModeId } from '@/api/knowledge'

export interface CardActionEvent {
  cardMessageId: string
  actionName: string
  payload?: unknown
  toolCallId?: string
}

let tempCounter = 0
let suppressCountdown = false
function nextTempId(): string {
  return `temp-${Date.now()}-${tempCounter++}`
}

function newClientMessageId(): string {
  return `cmsg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

type SSEEventType =
  | 'text_delta_start'
  | 'text_delta'
  | 'card'
  | 'done'
  | 'error'

const VALID_MESSAGE_TYPES: readonly MessageType[] = [
  'text',
  'action',
  'question',
  'judgement',
  'card',
  'hint',
  'clarify',
  'end',
]

function asMessageType(t: unknown): MessageType {
  if (
    typeof t === 'string' &&
    (VALID_MESSAGE_TYPES as readonly string[]).includes(t)
  ) {
    return t as MessageType
  }
  return 'text'
}

function normalizeMessage(m: any): ChatMessage {
  return {
    id: m.id,
    role: m.role,
    type: asMessageType(m.type),
    content: m.content ?? '',
    questionId: m.questionId ?? null,
    createdAt: m.createdAt,
    payload: m.payload ?? undefined,
    _streaming: false,
    _status: m.role === 'user' ? 'sent' : undefined,
  }
}

/**
 * ★ 从卡片 payload 里组装人类可读的 action 描述
 * - pick-topic: 从卡片 data.topics 里查 name
 * - 其他 action: 走 [xxx] 兜底
 */
function formatCardActionDisplay(
  actionName: string,
  payload: unknown,
  card?: ChatMessage,
): string {
  if (actionName === 'pick-topic') {
    const ids = (payload as any)?.topicIds as string[] | undefined
    const topics =
      ((card?.payload?.data as any)?.topics as
        | Array<{ id: string; name: string }>
        | undefined) ?? []
    if (ids?.length) {
      const names = ids
        .map((id) => topics.find((t) => t.id === id)?.name)
        .filter(Boolean) as string[]
      if (names.length) return `选择了主题：${names.join('、')}`
    }
    return '选择了主题'
  }
  return `[${actionName}]`
}

interface TypeItem {
  id: string
  text: string
}

export function useKnowledgeChat() {
  const modes = ref<ChatMode[]>([...MODES])
  const currentModeId = ref<ChatModeId>('topic-practice')
  const sessionId = ref<string>('')
  const state = ref<string>('')
  const messages = ref<ChatMessage[]>([])
  const topics = ref<Topic[]>([])
  const input = ref('')
  const waitingFirstToken = ref(false)
  const loading = waitingFirstToken

  const sessionList = ref<SessionListItem[]>([])
  const restoring = ref(false)

  const countdownRemaining = ref(0)
  const countdownPaused = ref(false)
  let countdownTimer: ReturnType<typeof setInterval> | null = null

  const COUNTDOWN_STATES = ['WAITING_FEEDBACK', 'DISCUSSING']
  const COUNTDOWN_FALLBACK = 10      // 找不到 judgement 时的兜底
  const COUNTDOWN_MIN = 5            // 最短 5 秒（避免秒过）
  const COUNTDOWN_MAX = 30           // 最长 30 秒（避免等到不耐烦）
  const READING_SPEED_CPS = 4        // 技术内容阅读速度：约 4 字/秒
  const READING_BASE_SECONDS = 2     // 基础反应时间（意识到评判出现）

  const countdownVisible = computed(
    () => countdownRemaining.value > 0 || countdownPaused.value,
  )

  /**
 * 从 messages 里找最新一条 judgement 消息
 * （DISCUSSING 状态下的讨论回复也是 type='judgement'）
 */
function findLatestJudgement(): ChatMessage | null {
  for (let i = messages.value.length - 1; i >= 0; i--) {
    const m = messages.value[i]
    if (m.type === 'judgement' || m.type === 'end') {   // ★ 加 end
      return m
    }
  }
  return null
}

  /**
   * 根据文本长度计算倒计时秒数
   *
   * 公式：字符数 / 阅读速度 + 基础反应时间，然后 clamp 到 [MIN, MAX]
   *
   * 例子：
   *   50 字 → 50/4 + 2 = 14.5 → 15 秒
   *   100 字 → 100/4 + 2 = 27 秒
   *   200 字 → 200/4 + 2 = 52 → 30 秒（clamp）
   *   20 字 → 20/4 + 2 = 7 秒
   */
  function computeCountdownSeconds(text: string | undefined): number {
    if (!text || text.length === 0) return COUNTDOWN_FALLBACK
    const raw =
      Math.ceil(text.length / READING_SPEED_CPS) + READING_BASE_SECONDS
    return Math.min(COUNTDOWN_MAX, Math.max(COUNTDOWN_MIN, raw))
  }

  function startCountdown(duration: number) {
    stopCountdownTimer()
    countdownRemaining.value = duration
    countdownPaused.value = false
    countdownTimer = setInterval(() => {
      countdownRemaining.value--
      if (countdownRemaining.value <= 0) {
        stopCountdownTimer()
        onCountdownTimeout()
      }
    }, 1000)
  }

  function stopCountdownTimer() {
    if (countdownTimer) {
      clearInterval(countdownTimer)
      countdownTimer = null
    }
  }

  function stopCountdown() {
    stopCountdownTimer()
    countdownRemaining.value = 0
    countdownPaused.value = false
  }

  function pauseCountdown() {
    if (countdownRemaining.value > 0 && !countdownPaused.value) {
      countdownPaused.value = true
      stopCountdownTimer()
    }
  }

  function resumeCountdown() {
    if (!countdownPaused.value) return
    countdownPaused.value = false
    stopCountdownTimer()   // 防止残留 timer 叠加
    if (countdownRemaining.value <= 0) {
      // 已经完全跑完过 → 重新按内容算时长（罕见场景，但保底）
      const latestJudgement = findLatestJudgement()
      const duration = computeCountdownSeconds(latestJudgement?.content)
      startCountdown(duration)
    } else {
      // 从剩余秒数继续（不重新计算——用户暂停前的进度要保住）
      countdownTimer = setInterval(() => {
        countdownRemaining.value--
        if (countdownRemaining.value <= 0) {
          stopCountdownTimer()
          onCountdownTimeout()
        }
      }, 1000)
    }
  }

  async function onCountdownTimeout() {
    // 打字中就不发
    if (input.value.trim()) {
      countdownPaused.value = true
      return
    }
    if (!COUNTDOWN_STATES.includes(state.value)) return
    try {
      await sendAction({ name: 'agree' })
    } catch (err) {
      console.warn('[countdown] sendAction failed:', err)
    }
    stopCountdown()
  }

  // ★ 状态变化 → 启停倒计时
  watch(
    () => [state.value, loading.value] as const,
    ([s, l]) => {
      const shouldCountdown = COUNTDOWN_STATES.includes(s) && !l

      if (!shouldCountdown) {
        stopCountdown()
        return
      }

      // ★ suppress 期间不启动倒计时
      if (suppressCountdown) return

      if (countdownRemaining.value === 0 && !countdownPaused.value) {
        const latest = findLatestJudgement()
        const duration = computeCountdownSeconds(latest?.content)
        startCountdown(duration)
      }
    },
    { immediate: true },
  )

  // ★ 输入变化 → 暂停/允许恢复
  watch(
    () => input.value,
    (v) => {
      if (!COUNTDOWN_STATES.includes(state.value)) return
      if (v.trim()) {
        // 有内容 → 暂停
        pauseCountdown()
      }
      // 清空后不自动恢复——让用户手动点“继续”
    },
  )
  

  let currentAbort: AbortController | null = null

  // ============ 打字机队列 ============
  const typeQueue: TypeItem[] = []
  let typingTimer: ReturnType<typeof setTimeout> | null = null
  let pendingCards: any[] = []
  let pendingDone: any = null

  function nextInterval(len: number): number {
    if (len > 150) return 5
    if (len > 80) return 10
    if (len > 40) return 15
    return 22
  }

  function enqueueTyping(messageId: string, delta: string) {
    for (const ch of delta) {
      typeQueue.push({ id: messageId, text: ch })
    }
    if (typingTimer == null) tickTyping()
  }

  function tickTyping() {
    if (typeQueue.length === 0) {
      typingTimer = null
      tryFlushPending()
      return
    }
    const item = typeQueue.shift()!
    appendDelta(item.id, item.text)
    typingTimer = setTimeout(tickTyping, nextInterval(typeQueue.length))
  }

  function tryFlushPending() {
    if (typeQueue.length > 0 || typingTimer != null) return
    while (pendingCards.length > 0) {
      const card = pendingCards.shift()
      finalizeMessage(card.messageId, card)
    }
    if (pendingDone) {
      state.value = pendingDone.newState
      loading.value = false
      closeStream()
      suppressCountdown = false
      pendingDone = null

      // ★ 新增：主动检查并启动倒计时（不依赖 watch）
      if (
        COUNTDOWN_STATES.includes(state.value) &&
        !loading.value &&
        countdownRemaining.value === 0 &&
        !countdownPaused.value
      ) {
        const latest = findLatestJudgement()
        const duration = computeCountdownSeconds(latest?.content)
        startCountdown(duration)
      }
    }
  }

  function clearTypingQueue() {
    typeQueue.length = 0
    if (typingTimer != null) {
      clearTimeout(typingTimer)
      typingTimer = null
    }
    pendingCards = []
    pendingDone = null
  }

  // ============ 计算属性 ============
  const currentModeName = computed(
    () =>
      modes.value.find((m) => m.id === currentModeId.value)?.name ??
      '主题练习',
  )

  const stateLabel = computed(() => {
    const map: Record<string, string> = {
      INIT: '初始化',
      PICKING_TOPIC: '选择主题',
      WAITING_ANSWER: '等待回答',
      WAITING_FEEDBACK: '等待反馈',
      DISCUSSING: '讨论中',
      DONE: '已结束',
    }
    return map[state.value] || state.value || '-'
  })

  const canInput = computed(() =>
    ['WAITING_ANSWER', 'WAITING_FEEDBACK', 'WAITING_RETRY'].includes(state.value),
  )

  const canSkip = computed(() =>
    ['WAITING_ANSWER', 'WAITING_FEEDBACK'].includes(state.value),
  )

  const hasPendingCard = computed(() =>
    messages.value.some(
      (m) => m.type === 'card' && m.payload?.status === 'pending',
    ),
  )

  const hasMessages = computed(() =>
    messages.value.some((m) => m.role === 'user'),
  )

  // ============ 消息操作 ============
  function pushUserMessage(
    content: string,
    type: 'text' | 'action',
  ): ChatMessage {
    const msg: ChatMessage = {
      id: nextTempId(),
      role: 'user',
      type,
      content,
      questionId: null,
      createdAt: new Date().toISOString(),
      _status: 'sending',
    }
    messages.value.push(msg)
    return msg
  }

  function updateMessageStatus(id: string, status: MessageStatus) {
    const msg = messages.value.find((m) => m.id === id)
    if (msg) msg._status = status
  }

  function findOrCreateStreamingMessage(
    messageId: string,
    meta: { role: string; type: string | null },
  ): ChatMessage {
    let msg = messages.value.find((m) => m.id === messageId)
    if (!msg) {
      msg = {
        id: messageId,
        role: (meta.role as any) || 'system',
        type: asMessageType(meta.type),
        content: '',
        questionId: null,
        createdAt: new Date().toISOString(),
        _streaming: true,
      }
      messages.value.push(msg)
    } else {
      msg._streaming = true
    }
    return msg
  }

  function appendDelta(messageId: string, delta: string) {
    const msg = messages.value.find((m) => m.id === messageId)
    if (msg) msg.content += delta
  }

  function finalizeMessage(
    messageId: string,
    data: {
      role?: string
      type: string | null
      content: string
      questionId?: string | null
      payload?: any
    },
  ) {
    const msg = messages.value.find((m) => m.id === messageId)
    if (msg) {
      if (!msg.content || data.content.length >= msg.content.length) {
        msg.content = data.content
      }
      if (data.type) msg.type = asMessageType(data.type)
      msg.questionId = data.questionId ?? msg.questionId ?? null
      if (data.payload) msg.payload = data.payload
      msg._streaming = false
    } else {
      messages.value.push({
        id: messageId,
        role: (data.role as any) || 'system',
        type: asMessageType(data.type),
        content: data.content,
        questionId: data.questionId ?? null,
        createdAt: new Date().toISOString(),
        _streaming: false,
        payload: data.payload,
      })
    }
  }

  // ============ 会话管理 ============
  function closeStream() {
    if (currentAbort) {
      currentAbort.abort()
      currentAbort = null
    }
  }

  async function refreshSessionList() {
    try {
      const { sessions } = await listSessions()
      sessionList.value = sessions
    } catch (err: any) {
      console.warn('[sessionList] load failed:', err?.message)
    }
  }

  async function resumeSession(id: string): Promise<boolean> {
    restoring.value = true
    closeStream()
    clearTypingQueue()
    stopCountdown()
    suppressCountdown = false   // ★ 新增
    try {
      const detail = await getSessionDetail(id)
      sessionId.value = detail.sessionId
      state.value = detail.state

      if (detail.stateMachineId) {
        currentModeId.value = detail.stateMachineId
      }

      messages.value = (detail.messages ?? []).map(normalizeMessage)
      input.value = ''
      return true
    } catch (err: any) {
      console.warn('[resume] failed:', err?.message)
      return false
    } finally {
      restoring.value = false
    }
  }

  async function startNewSession(modeId?: ChatModeId): Promise<boolean> {
    closeStream()
    clearTypingQueue()
    stopCountdown()
    suppressCountdown = false   // ★ 新增：切换会话时重置
    loading.value = true
    try {
      const effectiveMode = modeId ?? currentModeId.value
      currentModeId.value = effectiveMode

      const session = await createSession(effectiveMode)
      sessionId.value = session.sessionId
      state.value = session.state

      messages.value = (session.initialMessages ?? []).map(normalizeMessage)

      if (import.meta.env.DEV) {
        const hasPicker = messages.value.some(
          (m) => m.type === 'card' && m.payload?.cardType === 'topic-picker',
        )
        if (session.state === 'PICKING_TOPIC' && !hasPicker) {
          console.warn(
            '[contract] state=PICKING_TOPIC 但 initialMessages 中没有 topic-picker 卡片。' +
            '请后端在 createSession 返回值中下发该卡片消息。',
          )
        }
      }

      input.value = ''
      refreshSessionList()
      return true
    } catch (err: any) {
      ElMessage.error(
        err?.response?.data?.message ||
          err?.message ||
          '创建会话失败',
      )
      return false
    } finally {
      loading.value = false
    }
  }

  async function switchMode(newModeId: ChatModeId): Promise<boolean> {
    if (newModeId === currentModeId.value && hasMessages.value) {
      try {
        await ElMessageBox.confirm(
          '开始新对话？当前会话将被清空。',
          '提示',
          {
            confirmButtonText: '开始新对话',
            cancelButtonText: '取消',
            type: 'info',
          },
        )
      } catch {
        return false
      }
    }
    return await startNewSession(newModeId)
  }

  async function newSession(): Promise<boolean> {

    return await startNewSession()
  }

  async function switchSession(id: string): Promise<boolean> {
    if (loading.value || restoring.value) return false
    if (id === sessionId.value) return false

    return await resumeSession(id)
  }

  // ============ 初始化 ============
  async function bootstrap() {
    loading.value = true
    try {
      const t = await listTopics()
      topics.value = t.topics
    } catch (err: any) {
      console.warn('[topics] load failed:', err?.message)
    } finally {
      loading.value = false
    }
    refreshSessionList()
  }

  // ============ 核心：保存 + SSE ============
  async function submitEvent(
    event: SessionEvent,
    optimisticMsg: ChatMessage,
    clientMessageId: string,
  ): Promise<boolean> {
    if (!sessionId.value) return false

    let messageId: string
    try {
      const saved = await saveMessage(
        sessionId.value,
        event,
        clientMessageId,
      )
      messageId = saved.messageId
      updateMessageStatus(optimisticMsg.id, 'sent')
    } catch (err: any) {
      ElMessage.error(
        err?.response?.data?.message ||
          err?.message ||
          '发送失败',
      )
      updateMessageStatus(optimisticMsg.id, 'failed')
      return false
    }

    loading.value = true
    closeStream()

    const ctrl = new AbortController()
    currentAbort = ctrl

    const url = getStreamUrl(sessionId.value, messageId)

    const openStream = async (): Promise<void> => {
      const token = authStore.accessToken
      if (!token) throw new Error('no access token')

      await fetchEventSource(url, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'text/event-stream',
        },
        signal: ctrl.signal,

        async onopen(response) {
          if (response.status === 401) {
            try {
              await refreshAccessToken()
            } catch (err) {
              ElMessage.error('登录已过期，请重新登录')
              loading.value = false
              throw err
            }
            return openStream()
          }
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}`)
          }
          const contentType = response.headers.get('content-type')
          if (!contentType?.includes('text/event-stream')) {
            throw new Error(
              `Expected text/event-stream, got ${contentType}`,
            )
          }
        },

        onmessage(ev) {
          let parsed: any
          try {
            parsed = JSON.parse(ev.data)
          } catch {
            console.warn('[SSE] invalid JSON:', ev.data)
            return
          }

          const eventType = parsed.type as SSEEventType | ''
          const payload = parsed.data ?? {}
          if (!eventType) return

          switch (eventType) {
            case 'text_delta_start':
              loading.value = false
              messages.value.forEach((m) => {
                  if (m.id !== payload.messageId) {
                    m._streaming = false
                  }
              })
              findOrCreateStreamingMessage(payload.messageId, {
                role: payload.role,
                type: payload.type,
              })
              break

            case 'text_delta':
              loading.value = false
              enqueueTyping(payload.messageId, payload.delta)
              break

            case 'card':
              if (payload.cardType) {
                finalizeMessage(payload.messageId, payload)
              } else {
                pendingCards.push(payload)
                tryFlushPending()
              }
              break

            case 'done':
              pendingDone = payload
              tryFlushPending()
              break

            case 'error':
              ElMessage.error(payload.message || '处理失败')
              loading.value = false
              ctrl.abort()
              break

            default:
              console.warn('[SSE] unknown event type:', eventType, payload)
          }
        },

        onclose() {
          if (typeQueue.length === 0 && typingTimer == null) {
            loading.value = false
          }
        },

        onerror(err) {
          throw err
        },
      })
    }

    try {
      await openStream()
      refreshSessionList()
      return true
    } catch (err: any) {
      if (err?.name === 'AbortError') return true
      console.error('[SSE] fatal error:', err)
      ElMessage.error(
        err?.message?.includes('HTTP')
          ? '服务异常，请稍后重试'
          : '连接中断',
      )
      loading.value = false
      closeStream()
      return false
    }
  }

  async function sendAction(action: { name: string; payload?: unknown }) {
    if (loading.value) return

    // ★ 同上
    if (COUNTDOWN_STATES.includes(state.value)) {
      suppressCountdown = true
      stopCountdown()
    }

    const clientMessageId = newClientMessageId()
    const msg = pushUserMessage(`[${action.name}]`, 'action')
    await submitEvent(
      { source: 'action', action },
      msg,
      clientMessageId,
    )
  }


  // ============ 统一卡片动作入口 ============
  async function dispatchCardAction(ev: CardActionEvent) {
    if (loading.value) return

    const card = messages.value.find((m) => m.id === ev.cardMessageId)
    if (!card || card.payload?.status !== 'pending') return

    card.payload.status = 'acting'
    card.payload.resolvedAction = ev.actionName
    card.payload.resolvedPayload = ev.payload
    card.payload.resolvedAt = new Date().toISOString()

    // ★ 组装人类可读的 content，一起 push + 发给后端
    const display = formatCardActionDisplay(ev.actionName, ev.payload, card)

    const clientMessageId = newClientMessageId()
    const msg = pushUserMessage(display, 'action')

    const ok = await submitEvent(
      {
        source: 'action',
        content: display,                 // ★ 传给后端，后端存到 DB
        action: {
          name: ev.actionName,
          payload: ev.payload,
          cardMessageId: ev.cardMessageId,
          toolCallId: ev.toolCallId,
        },
      },
      msg,
      clientMessageId,
    )

    if (ok) {
      card.payload.status = 'resolved'
    } else {
      card.payload.status = 'pending'
      card.payload.resolvedAction = undefined
      card.payload.resolvedPayload = undefined
      card.payload.resolvedAt = undefined
    }
  }

  // ============ 交互入口 ============
  async function sendMessage() {
    const text = input.value.trim()
    if (!text || loading.value || !canInput.value) return

    // ★ 如果在倒计时状态，先 suppress
    if (COUNTDOWN_STATES.includes(state.value)) {
      suppressCountdown = true
      stopCountdown()
    }

    input.value = ''
    const clientMessageId = newClientMessageId()
    const msg = pushUserMessage(text, 'text')

    await submitEvent(
      { source: 'text', content: text },
      msg,
      clientMessageId,
    )
  }

  async function skip() {
    if (loading.value) return
    const clientMessageId = newClientMessageId()
    const display = '跳过了本题'                // ★ 也改成人类可读
    const msg = pushUserMessage(display, 'action')
    await submitEvent(
      { source: 'action', content: display, action: { name: 'skip' } },
      msg,
      clientMessageId,
    )
  }

  async function resendMessage(message: ChatMessage) {
    if (loading.value) return
    if (message._status !== 'failed') return

    updateMessageStatus(message.id, 'sending')

    const event = reconstructEvent(message)
    if (!event) {
      ElMessage.error('无法重发这条消息')
      updateMessageStatus(message.id, 'failed')
      return
    }

    const clientMessageId = newClientMessageId()
    await submitEvent(event, message, clientMessageId)
  }

  function reconstructEvent(msg: ChatMessage): SessionEvent | null {
    if (msg.type === 'action') {
      // ① 协议格式 [xxx] —— 老消息走这里
      const match = msg.content.match(/^\[(.+)\]$/)
      if (match) {
        return { source: 'action', action: { name: match[1] } }
      }
      // ② 人类可读格式 —— 从 content 推回 name 不方便，尽量保 content
      //    （action 类型重发很少见，这里给个宽泛回退）
      return { source: 'action', content: msg.content, action: { name: 'unknown' } }
    }
    return { source: 'text', content: msg.content }
  }

  async function nextQuestionNow() {
    if (loading.value) return
    if (!COUNTDOWN_STATES.includes(state.value)) return

    // ★ 先标 suppress，再 stop，防止 SSE 过程中的 loading 变化触发重启
    suppressCountdown = true
    stopCountdown()

    try {
      await sendAction({ name: 'agree' })
    } catch (err) {
      console.warn('[nextQuestionNow] failed:', err)
      suppressCountdown = false   // 失败时立刻恢复
    }
  }

  // ============ 导出 ============
  return {
    modes,
    currentModeId,
    currentModeName,
    state,
    stateLabel,
    messages,
    topics,
    input,
    loading,

    canInput,
    canSkip,
    hasPendingCard,
    hasMessages,

    sessionId,
    sessionList,
    restoring,

    bootstrap,
    startNewSession,
    resumeSession,
    refreshSessionList,

    switchMode,
    switchSession,
    newSession,

    dispatchCardAction,
    sendMessage,
    skip,
    resendMessage,
    sendAction,

    countdownRemaining,
    countdownPaused,
    countdownVisible,
    pauseCountdown,
    resumeCountdown,
    nextQuestionNow,
  }
}