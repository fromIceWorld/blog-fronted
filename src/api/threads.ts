// ============================================================
// 类型定义
// ============================================================

import { api } from "./auth"

// ★ 结构化判分明细（对齐后端 jsonb）
//   - hitPoints 元素只有 summary
//   - missingPoints 元素有 summary + type + importance
//   - wrongPoints 元素有 summary + reason + severity + errorType
//   为了让组件复用，统一用宽松类型（字段都可选）
export interface JudgementPointDetail {
  summary: string
  // missingPoints 特有
  type?: string
  importance?: string
  // wrongPoints 特有
  reason?: string
  severity?: string
  errorType?: string
}

export interface ThreadListItem {
  threadId: string
  sessionId: string

  conceptId: string
  conceptName: string
  topicId: string | null

  originalQuestionId: string
  originalQuestionPreview: string
  originalAngle: string
  difficulty: number | null

  originalVerdict: string | null
  originalScore: number | null
  finalVerdict: string | null
  finalScore: number | null
  masteryWeight: number | null

  retryRounds: number
  discussionRounds: number
  hadDiscussion: boolean
  hadDiscussionRevision: boolean

  status: string
  startedAt: string
  finishedAt: string | null
}

export interface ThreadListResult {
  items: ThreadListItem[]
  total: number
}

export interface ThreadDetailRetry {
  id: string
  retryRound: number
  retryTargetPoint: string | null
  retryQuestionText: string | null
  userAnswer: string | null
  verdict: string
  score: number
  correctness: number
  completeness: number

  // ★ 结构化明细
  hitPoints: JudgementPointDetail[]
  missingPoints: JudgementPointDetail[]
  wrongPoints: JudgementPointDetail[]

  // ★ 决策轨迹（追问轮次为 null）
  decisionType: string | null
  decisionReason: string | null
  decisionForceAngle: string | null

  feedback: string
  judgedAt: string
}

export interface ThreadDetailMessage {
  id: string
  role: string
  type: string | null
  content: string
  questionId: string | null
  createdAt: string
  judgementId: string | null
  payload: any
}

export interface ThreadDetail {
  threadId: string
  sessionId: string
  status: string

  concept: {
    id: string
    name: string
    definition: string | null
  }
  topicId: string | null
  originalAngle: string

  startedAt: string
  finishedAt: string | null

  finalVerdict: string | null
  finalScore: number | null
  masteryWeight: number | null
  retryRounds: number
  discussionRounds: number
  hadDiscussion: boolean
  hadDiscussionRevision: boolean

  originalQuestion: {
    id: string
    question: string
    keyPoints: string[]
    intent: string
    angle: string
    difficulty: number
  } | null

  originalAnswer: string | null
  originalJudgement: {
    id: string
    verdict: string
    score: number
    correctness: number
    completeness: number

    // ★ 结构化明细
    hitPoints: JudgementPointDetail[]
    missingPoints: JudgementPointDetail[]
    wrongPoints: JudgementPointDetail[]

    // ★ 决策轨迹（原题判分一定有，追问轮次为 null）
    decisionType: string | null
    decisionReason: string | null
    decisionForceAngle: string | null

    // ★ 溯源信息
    trigger: string
    retryRound: number
    retryTargetPoint: string | null
    revisedByDiscussion: boolean

    feedback: string
    judgedAt: string
  } | null

  retries: ThreadDetailRetry[]

  messages: ThreadDetailMessage[]
}

// ============================================================
// API
// ============================================================

export async function listThreads(params: {
  limit?: number
  offset?: number
  status?: string
  conceptId?: string
}): Promise<ThreadListResult> {
  const cleanParams: Record<string, any> = {}
  for (const [k, v] of Object.entries(params)) {
    if (v !== null && v !== undefined && v !== '') cleanParams[k] = v
  }
  const raw: any = await api.get('/knowledge/threads', {
    params: cleanParams,
  })
  return raw?.items ? raw : (raw?.data ?? raw)
}

export async function getThreadDetail(
  threadId: string,
): Promise<ThreadDetail | null> {
  const raw: any = await api.get(`/knowledge/threads/${threadId}`)
  return raw?.threadId ? raw : (raw?.data ?? raw)
}