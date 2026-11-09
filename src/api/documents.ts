import { api } from './auth'

export interface DocumentItem {
  id: string
  title: string
  sourceType: string
  stage: string
  progress: number
  conceptCount?: number
  errorMessage?: string | null
  createdAt: string
  updatedAt: string
}

export async function uploadDocument(payload: {
  title: string
  text: string
}): Promise<{ documentId: string; stage: string }> {
  return api.post('/documents/upload', payload)
}

export async function listDocuments(): Promise<{ documents: DocumentItem[]}> {
  const { data } = await api.get('/documents') as any
  return data
}

export async function getDocumentStatus(id: string) {
  return api.get(`/documents/${id}/status`)
}

export async function deleteDocument(id: string): Promise<void> {
  return api.delete(`/documents/${id}`)
}

export async function retryDocument(id: string): Promise<void> {
  return api.post(`/documents/${id}/retry`)
}

export async function listProcessingDocuments(): Promise<{ documents: DocumentItem[] }> {
  return api.get('/documents', {
    params: { stage: 'processing' },  // 后端支持按阶段筛选
  })
}

export async function getDocumentsBatchStatus(
  ids: string[],
): Promise<{ documents: DocumentItem[] }> {
  return api.post('/documents/batch-status', { ids })
}