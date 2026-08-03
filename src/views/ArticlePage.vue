<script setup lang="ts">
import { onMounted, ref, useTemplateRef } from 'vue'
import { useRouter } from 'vue-router'
import { fetchArticles } from '../api/article'
import type { Article } from '../types/article'
import ArticleOverview from './articles/components/ArticleOverviewCard.vue'
import ArticleTypeMenu from '../components/ArticleTypeMenu.vue'
import HotArticle from '../components/HotArticle.vue'

const router = useRouter()
const articles = ref<Article[]>([])
const pageConfig = ref({
  currentPage: -1,
  pageSize: 10,
  total: 0
})
const isLoading = ref(false)
const isFinish = ref(false)

const message = ref('')

const scrollGuardRef = useTemplateRef('scrollGuard')

async function loadArticles() {
  if(isFinish.value) {
    return
  }
  isLoading.value = true
  try {
    const { list, total } = await fetchArticles(
       {
          currentPage: pageConfig.value.currentPage,
          pageSize: pageConfig.value.pageSize,
       }
    );
    console.log('fetchArticles', list)
    if(!list.length) {
      isFinish.value = true
    }
    articles.value = [...articles.value, ...list]
    pageConfig.value.total = total
  } catch (error) {
    message.value = '加载文章失败'
  } finally {
    isLoading.value = false
  }
}

const goArticle = (article: Article) => {
  console.log(article)
  router.push(`/articles/view-article/${article.id}`)
}

const createIntersectionObserver = () => {
  const intersection = new IntersectionObserver((entries) => {
    if (entries[0].intersectionRatio <= 0) return;
    loadMoreArticles()
  })
  scrollGuardRef.value && intersection.observe(scrollGuardRef.value)
}

onMounted(() => {
  createIntersectionObserver()
})

const onUpdateCollection = (value: number, index: number) => {
  const article = articles.value[index]
  article['isCollected'] = !article['isCollected'];
  article.collection += value
}

const loadMoreArticles = () => {
  pageConfig.value.currentPage += 1
  loadArticles()
}

function goEdit() {
  router.push('/create-article')
}

</script>

<template>
  <div class="article-index"> 
    <div class="article-type">
      <ArticleTypeMenu />
    </div>
    <div class="article-list-container">
      <ArticleOverview 
        v-for="(article, index) in articles" 
        :key = "article.id"
        :article="article"
        @click="() => goArticle(article)"
        @updateCollection = "(value) => onUpdateCollection(value, index)"
      />
      <div class="guard" ref="scrollGuard">
        {{ isLoading ? '加载中...' : '已经到底了' }}
      </div>
    </div>
    <div class="hot-article">
      <HotArticle />
    </div>
    <!-- 写作按钮 -->
    <el-link 
        icon="Edit" 
        class="edit-btn" 
        :underline="false" 
        type="primary"
        @click="goEdit"
        >
    </el-link>
  </div>
</template>


<style scoped>
.article-index {
  display: flex;
  gap: 10px;
  padding: 12px;
  background-color: #f2f3f5;
  height: calc(100vh - 60px);
  overflow-y: auto;
}
.article-index .article-type {
  flex-basis: 200px;
  position: sticky;
  top: 0;
}
.hot-article {
  width: 300px;
  flex-shrink: 0;
}
.article-list-container {
  height: fit-content;
  flex: 1;
  background-color: white;
  padding: 10px 0;
}
.article-list-container :deep(.el-card){
  margin: 0 10px;
  padding: 10px 0;
}
.index-page :deep(.el-card__header), :deep(.el-card__footer), :deep(.el-card__body) {
  padding: 8px
}
.index-page :deep(.el-card) {
  box-shadow: unset
}
.guard {
    text-align: center;
    padding-top: 10px;
    font-size: 12px;
    color: #8a919f;
}
.edit-btn {
  position: fixed;
  right: 40px;
  bottom: 40px;
  font-size: 30px;
}

</style>
