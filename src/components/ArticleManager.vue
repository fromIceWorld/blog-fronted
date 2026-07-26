<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { createArticle, deleteArticle, fetchArticles, updateArticle } from '../api/article'
import { login } from '../api/auth'
import type { Article } from '../types/article'

const articles = ref<Article[]>([])
const loading = ref(false)
const form = reactive<Article>({ title: '', content: '' })
const editingId = ref<number | null>(null)
const message = ref('')
const isLoggedIn = ref(false)
const authForm = reactive({ username: '', password: '' })
const authLoading = ref(false)

const isEditing = computed(() => editingId.value !== null)

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

function resetForm() {
  form.title = ''
  form.content = ''
  editingId.value = null
  message.value = ''
}

async function submitAuth() {
  if (!authForm.username.trim() || !authForm.password.trim()) {
    message.value = '请输入用户名和密码'
    return
  }

  authLoading.value = true
  try {
    const res = await login({ username: authForm.username, password: authForm.password })
    if (res.token || res.accessToken || res.data?.token) {
      isLoggedIn.value = true
      message.value = '登录成功'
      await loadArticles()
    } else {
      message.value = res.message || '登录失败'
    }
  } catch (error) {
    message.value = '登录失败，请检查接口'
  } finally {
    authLoading.value = false
  }
}

async function submitForm() {
  if (!form.title.trim()) {
    message.value = '请输入标题'
    return
  }

  try {
    if (isEditing.value && editingId.value) {
      await updateArticle(editingId.value, { ...form })
      message.value = '更新成功'
    } else {
      await createArticle({ ...form })
      message.value = '创建成功'
    }
    await loadArticles()
    resetForm()
  } catch (error) {
    message.value = '提交失败'
  }
}

function editArticle(article: Article) {
  form.title = article.title
  form.content = article.content || ''
  editingId.value = article.id ?? null
  message.value = ''
}

async function removeArticle(id?: number) {
  if (!id) return

  try {
    await deleteArticle(id)
    message.value = '删除成功'
    await loadArticles()
    if (editingId.value === id) {
      resetForm()
    }
  } catch (error) {
    message.value = '删除失败'
  }
}

onMounted(() => {
  loadArticles()
})
</script>

<template>
  <div class="page">
    <div class="card">
      <div class="header">
        <div>
          <h1>文章管理</h1>
          <p>先登录，再进行文章 CRUD</p>
        </div>
        <button v-if="isLoggedIn" class="ghost" @click="resetForm">新建文章</button>
      </div>

      <div v-if="message" class="message">{{ message }}</div>

      <div v-if="!isLoggedIn" class="login-box">
        <h2>登录</h2>
        <form class="form" @submit.prevent="submitAuth">
          <label>
            用户名
            <input v-model="authForm.username" name="username" placeholder="请输入用户名" />
          </label>
          <label>
            密码
            <input v-model="authForm.password" name="password" type="password" placeholder="请输入密码" />
          </label>
          <button type="submit" :disabled="authLoading">{{ authLoading ? '登录中...' : '登录' }}</button>
        </form>
      </div>

      <div v-else class="grid">
        <form class="form" @submit.prevent="submitForm">
          <h2>{{ isEditing ? '编辑文章' : '创建文章' }}</h2>
          <label>
            标题
            <input v-model="form.title" placeholder="请输入文章标题" />
          </label>
          <label>
            内容
            <textarea v-model="form.content" rows="8" placeholder="请输入文章内容"></textarea>
          </label>
          <button type="submit">{{ isEditing ? '保存修改' : '发布文章' }}</button>
        </form>

        <div class="list">
          <h2>文章列表</h2>
          <ul>
            <li v-for="article in articles" :key="article.id">
              <div>
                <strong>{{ article.title }}</strong>
                <p>{{ article.summary || '暂无内容' }}</p>
              </div>
              <div class="actions">
                <button class="ghost" @click="editArticle(article)">编辑</button>
                <button class="danger" @click="removeArticle(article.id)">删除</button>
              </div>
            </li>
          </ul>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.page {
  min-height: 100vh;
  padding: 32px;
  background: linear-gradient(135deg, #f5f7ff, #eef3ff);
}
.card {
  max-width: 1100px;
  margin: 0 auto;
  background: white;
  border-radius: 20px;
  padding: 24px;
  box-shadow: 0 15px 40px rgba(0, 0, 0, 0.08);
}
.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}
.grid {
  display: grid;
  gap: 24px;
  grid-template-columns: 1fr 1fr;
}
.form,
.list,
.login-box {
  border: 1px solid #e5e7eb;
  border-radius: 16px;
  padding: 16px;
}
.login-box {
  max-width: 420px;
  margin: 0 auto;
}
label {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin: 12px 0;
  font-weight: 600;
}
input,
textarea,
button {
  font: inherit;
}
input,
textarea {
  border: 1px solid #d1d5db;
  border-radius: 10px;
  padding: 10px 12px;
}
button {
  border: none;
  border-radius: 10px;
  padding: 10px 14px;
  cursor: pointer;
  background: #2563eb;
  color: white;
}
button:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}
.ghost {
  background: #e5e7eb;
  color: #111827;
}
.danger {
  background: #dc2626;
}
.message {
  margin-bottom: 16px;
  padding: 10px 12px;
  border-radius: 10px;
  background: #eff6ff;
  color: #1d4ed8;
}
ul {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
li {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding: 12px;
  border: 1px solid #f3f4f6;
  border-radius: 12px;
  background: #fafafa;
}
.actions {
  display: flex;
  gap: 8px;
}
@media (max-width: 800px) {
  .grid {
    grid-template-columns: 1fr;
  }
}
</style>
