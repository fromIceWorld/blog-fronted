import { api } from "./auth"

export interface QuestionSearchItem {
  id: string
  question: string
  keyPoints: string[]
  intent: string
  angle: string | null
  difficulty: string
  status: string
  sourceDocId: string | null
  docTitle: string | null
  uploadedBy: number | null
  conceptId: string | null
  conceptName: string | null
  judgementCount: number
  createdAt: string
}

export interface QuestionSearchResult {
  questions: QuestionSearchItem[]
  total: number
  page: number
  pageSize: number
}

export async function searchQuestions(params: {
  scope?: 'my' | 'all'
  search?: string
  docId?: string | null
  conceptId?: string | null
  topicId?: string | null
  angle?: string | null
  intent?: string | null
  difficulty?: string | null
  status?: string
  page?: number
  pageSize?: number
}): Promise<QuestionSearchResult> {
  // 清理 null / 空字符串
  const cleanParams: Record<string, any> = {}
  for (const [k, v] of Object.entries(params)) {
    if (v !== null && v !== undefined && v !== '') {
      cleanParams[k] = v
    }
  }
  // ★ 兼容 axios 原生响应和解包响应
  const raw: any = await api.get('/knowledge/questions', {
    params: cleanParams,
  })
  return raw?.questions ? raw : (raw?.data ?? raw)
}