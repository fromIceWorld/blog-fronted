import { api } from './auth'

// ============================================================
// trace.thread 返回结构
// 与后端 TraceController.traceThread 的返回完全对齐
// ============================================================

export interface TraceThreadInfo {
  id: string
  sessionId: string
  conceptId: string
  conceptName: string
  originalAngle: string
  originalQuestion: string | null
  originalQuestionKeyPoints: string[]
  originalQuestionSource: string | null
  finalVerdict: string | null
  finalScore: number | null
  masteryWeight: number | null
  retryRounds: number
  discussionRounds: number
  hadDiscussion: boolean
  hadDiscussionRevision: boolean
  startedAt: string
  finishedAt: string | null
}

export interface TraceMessage {
  id: string
  role: string
  type: string | null
  content: string
  questionId: string | null
  createdAt: string
  // ★ 观测字段（可能为 null，老数据没有）
  classifyIntent: string | null
  classifyConfidence: number | null
  classifySource: string | null
  classifyReason: string | null
  routeKey: string | null
  processDurationMs: number | null
}

export interface TraceJudgementPoint {
  summary: string
  // missingPoints 特有
  type?: string
  importance?: string
  // wrongPoints 特有
  reason?: string
  severity?: string
  errorType?: string
}

export interface TraceJudgement {
  id: string
  trigger: string
  retryRound: number
  retryTargetPoint: string | null
  score: number
  verdict: string
  correctness: number
  completeness: number
  hitPoints: TraceJudgementPoint[]
  missingPoints: TraceJudgementPoint[]
  wrongPoints: TraceJudgementPoint[]
  feedback: string
  // ★ 决策轨迹
  decisionType: string | null
  decisionReason: string | null
  decisionForceAngle: string | null
  // ★ 讨论修正
  isEffective: boolean
  revisedByDiscussion: boolean
  correctionOf: string | null
  supersededBy: string | null
  createdAt: string
}

export interface TraceLlmCall {
  id: string
  callType: string
  model: string
  status: string
  promptVersion: string | null
  prompt: string
  responseRaw: string | null
  responseParsed: any | null
  promptTokens: number | null
  completionTokens: number | null
  promptCacheHitTokens: number | null
  promptCacheMissTokens: number | null
  durationMs: number | null
  errorMessage: string | null
  createdAt: string
}

export interface TraceThread {
  thread: TraceThreadInfo
  messages: TraceMessage[]
  judgements: TraceJudgement[]
  llmCalls: TraceLlmCall[]
}

// ============================================================
// trace.recentThreads 返回结构
// ============================================================

export interface TraceRecentThreadItem {
  threadId: string
  sessionId: string
  conceptId: string
  conceptName: string          // ★ 新增
  originalAngle: string
  finalVerdict: string | null
  finalScore: number | null
  retryRounds: number
  discussionRounds: number
  startedAt: string
  finishedAt: string | null
}

// ============================================================
// API
// ============================================================

/**
 * 获取单个 thread 的完整 trace
 * 返回 thread 基本信息 + 消息 + 判分 + LLM 调用
 */
export async function getTraceThread(
  threadId: string,
): Promise<TraceThread | null> {
  const raw: any = await api.get(
    `/knowledge/trace/threads/${threadId}`,
  )
  // 兼容后端可能返回 { data: ... } 包裹
  return raw?.thread ? raw : (raw?.data ?? raw)
}

/**
 * 最近的 thread 列表
 */
export async function getRecentThreads(
  limit = 20,
): Promise<TraceRecentThreadItem[]> {
  const raw: any = await api.get(`/knowledge/trace/recent`, {
    params: { limit },
  })
  // 兼容数组直接返回 / 包裹
  return Array.isArray(raw) ? raw : (raw?.data ?? raw ?? [])
}