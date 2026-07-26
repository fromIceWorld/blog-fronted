<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { createArticle, deleteArticle, fetchArticles, updateArticle } from '../api/article'
import { clearAccessToken } from '../api/auth'
import type { Article } from '../types/article'
import ArticleOverview from './articles/components/ArticleOverview.vue'
import ArticleTypeMenu from '../components/ArticleTypeMenu.vue'
import HotArticle from '../components/HotArticle.vue'
import Header from '../common/Header.vue'
const router = useRouter()
const articles = ref<Article[]>([])
const loading = ref(false)
const message = ref('')

async function loadArticles() {
  loading.value = true
  try {
    articles.value = await fetchArticles()
  } catch (error) {
    message.value = '加载文章失败'
  } finally {
    loading.value = false
  }
}

function goEdit() {
  router.push('/create-article')
}

onMounted(() => {
  loadArticles()
})

const onUpdateCollection = (value: number, index: number) => {
  const article = articles.value[index]
  article['isCollected'] = !article['isCollected'];
  article.collection += value
}

</script>

<template>
  <div class="mian-page">
    <div class="header-container">
      <Header />
    </div>
    <div class="body-container">
      <div class="article-index"> 
        <div class="article-type">
          <ArticleTypeMenu />
        </div>
        <div class="article-list-container" >
          <ArticleOverview 
            v-for="(article, index) in articles" 
            :key = "article.id"
            :article="article"
            @updateCollection = "(value) => onUpdateCollection(value, index)"
          />
        </div>
        <div class="hot-article">
          <HotArticle />
        </div>
      </div>
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
}
.article-list-container :deep(.el-card){
  margin: 10px;
}
.index-page :deep(.el-card__header), :deep(.el-card__footer), :deep(.el-card__body) {
  padding: 8px
}
.index-page :deep(.el-card) {
  box-shadow: unset
}
.edit-btn {
  position: fixed;
  right: 40px;
  bottom: 40px;
  font-size: 30px;
}
</style>
