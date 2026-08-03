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

export interface ArticleInfo {
  content: string;
  collection: number;
  isCollected: boolean;
  like: number;
  dislike: number;
  commentCount: number; // 修正拼写
  id: string;
}
