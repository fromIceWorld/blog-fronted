import { createRouter, createWebHistory } from 'vue-router'
import { isAuthenticated } from '../api/auth'
import LoginPage from '../views/LoginPage.vue'
import ArticlePage from '../views/ArticlePage.vue'
import RegistrationPage from '../views/RegistrationPage.vue'
import CreateArticle from '../views/articles/components/CreateArticle.vue'

const routes = [
  {
    path: '/login',
    name: 'login',
    component: LoginPage,
  },
  {
    path: '/register',
    name: 'register',
    component: RegistrationPage,
  },
  {
    path: '/articles',
    name: 'articles',
    component: ArticlePage,
    meta: { requiresAuth: true },
  },
  {
    path: '/create-article',
    name: 'create-article',
    component: CreateArticle,
    meta: { requiresAuth: true },
  },
  {
    path: '/',
    redirect: '/login',
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

router.beforeEach((to, from, next) => {
  if (to.path === '/login' && isAuthenticated()) {
    if (from.path && from.path !== '/login') {
      next(false)
      return
    }

    next('/articles')
    return
  }

  next()
})

export default router
