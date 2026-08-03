import type { Article } from '../types/article'
import { api } from './auth'

export async function fetchArticles(params: any): Promise<{ list: Article[], total: number}> {
  const res = await api.get<{ list: Article[], total: number}>(`/articals?currentPage=${params.currentPage}&pageSize=${params.pageSize}`)
  return res.data
}

export async function createArticle(payload: { content: string, tags: string[]}) {
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

async function getArticleDetailById(id: string) {
    const data = await api.get(`/articals/getArticleDetailById/${id}`)
    return data
}

async function logArticleView(id: string) {
    const data = await api.post(`/articals/${id}/view`)
    return data
}


async function getAllTags() {
    const data = await api.get(`/articals/tags`)
    return data
}


async function getArticleByQuery(query: string) {
    const data = await api.get(`/articals/query`, { params: { query }})
    return data
}


async function createArticleComment(params: any) {
    const data = await api.post(`/articals/createArticleComment`, params)
    return data
}


async function queryArticleComment(params: any) {
    const data = await api.get(`/articals/queryArticleComment`, { params })
    return data
}

export { 
  collection, getArticleDetailById, logArticleView, 
  getAllTags, getArticleByQuery, createArticleComment,
  queryArticleComment
}