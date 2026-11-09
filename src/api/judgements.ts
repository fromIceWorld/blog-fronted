import { api } from './auth'

export type Verdict = 'correct' | 'partial' | 'wrong' | 'missing'

export interface JudgementListItem {
  id: string
  questionId: string | null
  questionPreview: string
  intent: string | null
  angle: string | null
  score: number
  verdict: Verdict | null
  correctness: number | null
  completeness: number | null
  judgedAt: string
}

export interface JudgementDetail {
  id: string
  score: number
  verdict: Verdict | null
  correctness: number | null
  completeness: number | null
  nextAction: string | null
  hitPoints: string[]
  missingPoints: string[]
  wrongPoints: string[]
  feedback: string
  question: {
    question: string
    keyPoints: string[]
    intent: string | null
    angle: string | null
  } | null
  userAnswer: {
    content: string
    createdAt: string
  } | null
  judgedAt: string
}

export async function listJudgements(
  limit = 20,
  offset = 0,
): Promise<{ items: JudgementListItem[]; total: number }> {
  const { data } = await api.get('/knowledge/judgements', {
    params: { limit, offset },
  })
  return data
}

export async function getJudgementDetail(id: string): Promise<JudgementDetail> {
  const { data } = await api.get(`/knowledge/judgements/${id}`)
  return data
}