export interface Article {
  id?: number
  title: string
  content: string
  summary: string  
  createdTime: string
  updatedTime: string,
  collection: number,
  isCollected: boolean
}

export interface CreateArticleDTO {
  content: string
}
