import type { Article } from '../types/article'
import { api } from './auth'

export async function fetchArticles(params: any): Promise<{ list: Article[], total: number}> {
  const res = await api.get<{ list: Article[], total: number}>(`/article?currentPage=${params.currentPage}&pageSize=${params.pageSize}`)
  return res.data
}

export async function createArticle(payload: { content: string, tags: string[]}) {
  const { data } = await api.post<Article>('/article', payload)
  return data
}

export async function updateArticle(id: number, payload: Article) {
  const { data } = await api.put<Article>(`/article/${id}`, payload)
  return data
}

export async function deleteArticle(id: number) {
  await api.delete(`/article/${id}`)
}

async function collection(id: string) {
    const data = await api.post(`/article/collection`, {id})
    return data
}

async function getArticleDetailById(id: string) {
    const data = await api.get(`/article/getArticleDetailById/${id}`)
    return data
}

async function logArticleView(id: string) {
    const data = await api.post(`/article/${id}/view`)
    return data
}


async function getAllTags() {
    const data = await api.get(`/article/tags`)
    return data
}


async function getArticleByQuery(query: string) {
    const data = await api.get(`/article/query`, { params: { query }})
    return data
}


async function createArticleComment(params: any) {
    const data = await api.post(`/article/createArticleComment`, params)
    return data
}


async function queryArticleComment(params: any) {
    const data = await api.get(`/article/queryArticleComment`, { params })
    return data
}

export { 
  collection, getArticleDetailById, logArticleView, 
  getAllTags, getArticleByQuery, createArticleComment,
  queryArticleComment
}