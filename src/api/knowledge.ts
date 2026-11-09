import { api, authStore } from './auth'

// ============================================================
// 类型
// ============================================================

export type MessageType =
  | 'text'
  | 'action'
  | 'question'
  | 'judgement'
  | 'card'
  | 'hint'
  | 'clarify'
  | 'end'

export type CardType = 'topic-picker'

export type CardStatus = 'pending' | 'acting' | 'resolved' | 'expired' | 'cancelled'

export type MessageStatus = 'sending' | 'sent' | 'failed'

export type ChatModeId = 'topic-practice' | 'interview' | 'single-question'

export interface ChatMode {
  id: ChatModeId
  name: string
  description?: string
}

export const MODES: ChatMode[] = [
  { id: 'topic-practice', name: '主题练习' },
  // 将来: { id: 'interview', name: '模拟面试' }
]

export interface SessionListItem {
  id: string
  stateMachineId: ChatModeId
  state: string
  createdAt: string
  lastActiveAt: string
  preview: string
}

export interface CardAction {
  name: string
  label: string
  style?: 'primary' | 'danger' | 'default'
  requiresInput?: boolean
}

export interface CardPayload {
  cardType: CardType
  title?: string
  body?: string
  data: unknown
  actions: CardAction[]
  status: CardStatus
  resolvedAction?: string
  resolvedPayload?: unknown
  resolvedAt?: string
  toolCallId?: string
}

export interface ChatMessage {
  id: string
  role: 'user' | 'system'
  content: string
  questionId?: string | null
  createdAt: string

  // 前端 UI 状态（后端不返回）
  type: MessageType
  payload?: CardPayload
  _status?: MessageStatus
  _streaming?: boolean
}

export interface Topic {
  id: string
  name: string
  nodeCount: number
}

export interface SessionInfo {
  sessionId: string
  state: string
  stateMachineId: ChatModeId
  startedAt: string
  initialMessages?: ChatMessage[]
}

export interface SessionDetail {
  sessionId: string
  state: string
  stateMachineId: ChatModeId
  startedAt: string
  messages: ChatMessage[]
}

export interface SessionAction {
  name: string
  payload?: unknown
  cardMessageId?: string
  toolCallId?: string
}

export interface SessionEvent {
  source: 'text' | 'action'
  content?: string
  action?: SessionAction
}

export interface StepResult {
  newState: string
  newMessages: ChatMessage[]
  intent?: string
  route?: string
}

export interface SaveMessageResult {
  messageId: string
  clientMessageId: string | null
  createdAt: string
}


// ============================================================
// Token 读取（供 SSE URL 使用，EventSource 不能带 header）
// ============================================================

export function getToken(): string {
  return authStore.accessToken!
}

function getBaseUrl(): string {
  return (
    (api.defaults.baseURL as string) ||
    import.meta.env.VITE_API_BASE_URL ||
    'http://localhost:3000'
  )
}

// ============================================================
// 会话 / 主题
// ============================================================

/** 拉主题列表 */
export async function listTopics(): Promise<{ topics: Topic[] }> {
  const { data } = await api.get('/knowledge/topics')
  return data
}

/** 创建会话（后端会自动走一次 init，返回 state=PICKING_TOPIC） */
export async function createSession(
  stateMachineId: ChatModeId = 'topic-practice',
): Promise<SessionInfo> {
  const { data } = await api.post('/knowledge/sessions', { stateMachineId })
  return data
}

// ============================================================
// 保存消息（秒回）
// ============================================================

export async function saveMessage(
  sessionId: string,
  event: SessionEvent,
  clientMessageId: string,
): Promise<SaveMessageResult> {
  const { data } = await api.post(
    `/knowledge/sessions/${sessionId}/message`,
    { event, clientMessageId },
  )
  return data
}

// ============================================================
// SSE 流式处理
// ============================================================

export function getStreamUrl(sessionId: string, messageId: string): string {
  const token = getToken()
  const base = getBaseUrl()
  return `${base}/knowledge/sessions/${sessionId}/stream?messageId=${encodeURIComponent(messageId)}&token=${encodeURIComponent(token)}`
}

// ============================================================
// 兼容旧接口（同步 step）
// ============================================================

export async function step(
  sessionId: string,
  event: SessionEvent,
): Promise<StepResult> {
  const { data } = await api.post(
    `/knowledge/sessions/${sessionId}/step`,
    { event },
  )
  return data
}

// ============================================================
// 查询
// ============================================================

/** 会话详情（含完整消息历史） */
export async function getSessionDetail(
  sessionId: string,
): Promise<SessionDetail> {
  const { data } = await api.get(`/knowledge/sessions/${sessionId}`)
  return data
}

/** 旧别名，保留兼容 */
export const getSession = getSessionDetail

/** 会话列表 */
export async function listSessions(
  limit = 20,
): Promise<{ sessions: SessionListItem[] }> {
  const { data } = await api.get('/knowledge/sessions', { params: { limit } })
  return data
}

/** 消息历史（单独接口） */
export async function getMessages(
  sessionId: string,
  limit?: number,
): Promise<{ messages: ChatMessage[] }> {
  const { data } = await api.get(
    `/knowledge/sessions/${sessionId}/messages`,
    { params: limit ? { limit } : {} },
  )
  return data
}

export interface TopicTreeNode {
  id: string
  name: string
  conceptCount: number
  children: TopicTreeNode[]
}

export async function getTopicTree(): Promise<{ tree: TopicTreeNode[] }> {
  const raw: any = await api.get('/knowledge/topics/tree')
  return raw?.tree ? raw : (raw?.data ?? raw)
}