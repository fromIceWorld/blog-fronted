import { api } from "./auth"

export type QuestionAngle =
  | 'definition'
  | 'application'
  | 'contrast'
  | 'edge-case'

export interface ConceptItem {
  id: string
  canonicalName: string
  definition: string
  difficulty: number
  domain: string | null
  keyPoints: string[]
  docId: string | null
  docTitle: string | null
  questionCount: number
  createdAt: string
  plan: {
    angles: QuestionAngle[]
    quota: Record<QuestionAngle, number>
    generated: Record<string, number>
    totalRequired: number
    totalGenerated: number
  }
}

export interface ConceptSearchResult {
  concepts: ConceptItem[]
  total: number
  totalQuestions: number
  page: number
  pageSize: number
}

export async function searchConcepts(params: {
  docId?: string | null
  topicId?: string | null
  difficulty?: string | null
  domain?: string | null
  hasQuestions?: boolean
  search?: string
  page?: number
  pageSize?: number
}): Promise<ConceptSearchResult> {
  const cleanParams: Record<string, any> = {}
  for (const [k, v] of Object.entries(params)) {
    if (v !== null && v !== undefined && v !== '') cleanParams[k] = v
  }
  const raw: any = await api.get('/knowledge/concepts', {
    params: cleanParams,
  })
  return raw?.concepts ? raw : (raw?.data ?? raw)
}

export async function generateQuestion(
  conceptId: string,
  angle?: QuestionAngle,
  forceNew: boolean = true,
): Promise<{ question: any }> {
  const raw: any = await api.post(
    `/knowledge/concepts/${conceptId}/generate-question`,
    { angle, forceNew },
  )
  return raw?.question ? raw : (raw?.data ?? raw)
}