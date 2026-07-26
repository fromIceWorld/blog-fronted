import type { Article } from '../types/article'
import { api } from './auth'

export async function fetchArticles() {
  const res = await api.get<Article[] | { data: Article[] }>('/articals')
  const payload = res.data

  if (Array.isArray(payload)) {
    return payload
  }

  return payload.data ?? []
}

export async function createArticle(payload: { content: string}) {
  const { data } = await api.post<Article>('/articals', payload)
  return data
}

export async function updateArticle(id: number, payload: Article) {
  const { data } = await api.put<Article>(`/articals/${id}`, payload)
  return data
}

export async function deleteArticle(id: number) {
  await api.delete(`/articals/${id}`)
}

async function collection(id: string) {
    const data = await api.post(`/articals/collection`, {id})
    return data
}

export { collection }