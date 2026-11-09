import { api } from "./auth"

export type Verdict = 'correct' | 'partial' | 'wrong' | 'missing'
export type MasteryStatus = 'not-started' | 'learning' | 'proficient' | 'mastered'
export type Angle = 'definition' | 'application' | 'contrast' | 'edge-case'

export interface MasteryItem {
  conceptId: string
  conceptName: string | null
  domain: string | null
  masteryScore: number
  totalAttempts: number
  correctAttempts: number
  lastVerdict: Verdict | null
  lastAttemptAt: string | null
  status: MasteryStatus
}

export interface AttemptItem {
  id: string
  judgementId: string
  angle: Angle | null
  verdict: Verdict
  score: number
  answeredAt: string
}

export interface ConceptDetail extends MasteryItem {
  attempts: AttemptItem[]
  byAngle: Record<string, { attempts: number; avgScore: number }>
}

export async function fetchAllMastery(): Promise<MasteryItem[]> {
  const { data } = await api.get('/knowledge/mastery')
  return data?.items ?? []    // ★ 解包
}

export async function fetchConceptDetail(conceptId: string): Promise<ConceptDetail | null> {
  const { data } = await api.get(`/knowledge/mastery/${conceptId}`)
  return data
}

export async function fetchJudgementDetail(judgementId: string) {
  const { data } = await api.get(`/judgements/${judgementId}`)
  return data
}