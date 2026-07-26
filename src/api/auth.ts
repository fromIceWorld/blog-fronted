import { reactive } from 'vue'
import axios, { AxiosHeaders, type InternalAxiosRequestConfig } from 'axios'

const api = axios.create({
  baseURL: 'http://localhost:3000',
  timeout: 10000,
  withCredentials: true,
})

interface TokenPayload {
  token?: string
  accessToken?: string
  message?: string
  data?: {
    token?: string
    accessToken?: string
  }
}

export interface LoginResponse extends TokenPayload {}

type RetryableRequestConfig = InternalAxiosRequestConfig & {
  __isRetry?: boolean
}

const authStore = reactive<{ accessToken: string | null }>({
  accessToken: null,
})

let isRefreshing = false
let refreshSubscribers: Array<(token: string | null) => void> = []
let hasRedirectedToLogin = false

function getTokenFromPayload(payload: TokenPayload | null | undefined) {
  if (!payload) return null

  const token = payload.accessToken ?? payload.token ?? payload.data?.accessToken ?? payload.data?.token
  return typeof token === 'string' && token ? token : null
}

function setAuthorizationHeader(config: RetryableRequestConfig, token: string | null) {
  const headers = AxiosHeaders.from(config.headers)

  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  } else {
    headers.delete('Authorization')
  }

  config.headers = headers
  return config
}

function clearSessionState() {
  authStore.accessToken = null
  isRefreshing = false
  refreshSubscribers = []
  hasRedirectedToLogin = false
}

function redirectToLogin() {
  if (typeof window === 'undefined') return
  if (hasRedirectedToLogin) return

  hasRedirectedToLogin = true
  window.location.assign('/login')
}

async function refreshAccessToken() {
  const res = await api.post<TokenPayload>('/auth/refresh')
  const token = getTokenFromPayload(res.data)

  if (!token) {
    throw new Error('Refresh token failed')
  }

  authStore.accessToken = token
  return token
}

api.interceptors.request.use((config) => {
  const requestConfig = config as RetryableRequestConfig

  if (requestConfig.url?.includes('/auth/login') || requestConfig.url?.includes('/auth/refresh')) {
    return requestConfig
  }

  if (authStore.accessToken) {
    setAuthorizationHeader(requestConfig, authStore.accessToken)
  }

  return requestConfig
})

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config as RetryableRequestConfig | undefined

    if (!originalRequest || !error.response) {
      return Promise.reject(error)
    }

    const isLoginRequest = originalRequest.url?.includes('/auth/login')
    const isRefreshRequest = originalRequest.url?.includes('/auth/refresh')

    if (isLoginRequest) {
      return Promise.reject(error)
    }

    if (error.response.status !== 401 || originalRequest.__isRetry) {
      return Promise.reject(error)
    }

    if (isRefreshRequest) {
      clearSessionState()
      redirectToLogin()
      return Promise.reject(error)
    }

    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        refreshSubscribers.push((token) => {
          if (!token) {
            reject(error)
            return
          }

          const retryConfig = { ...originalRequest, __isRetry: true } as RetryableRequestConfig
          setAuthorizationHeader(retryConfig, token)
          resolve(api.request(retryConfig))
        })
      })
    }

    isRefreshing = true

    try {
      const token = await refreshAccessToken()
      refreshSubscribers.forEach((callback) => callback(token))
      refreshSubscribers = []

      const retryConfig = { ...originalRequest, __isRetry: true } as RetryableRequestConfig
      setAuthorizationHeader(retryConfig, token)
      return await api.request(retryConfig)
    } catch (refreshError) {
      refreshSubscribers.forEach((callback) => callback(null))
      refreshSubscribers = []
      clearSessionState()
      redirectToLogin()
      return Promise.reject(refreshError)
    } finally {
      isRefreshing = false
    }
  },
)

export function setAccessToken(token: string | null) {
  authStore.accessToken = token
}

export function clearAccessToken() {
  authStore.accessToken = null
}

export function getAccessToken() {
  return authStore.accessToken
}

export function isAuthenticated() {
  return !!authStore.accessToken
}

export async function login(payload: { username?: string; password?: string; email?: string; phone?: string; code?: string; }) {
  const res = await api.post<LoginResponse>('/auth/login', payload)
  const token = getTokenFromPayload(res.data)

  if (token) {
    authStore.accessToken = token
  }

  return res.data
}

async function logOut() {
   const res = await api.post<LoginResponse>('/auth/logout')
   return res.data
}

export async function sendVerificationCode(payload: { email?: string; phone?: string }) {
  return api.post('/auth/send-code', payload)
}

export async function register(payload: { phone?: string; email?: string; username: string; password: string; }) {
  const res = await api.post<TokenPayload>('/auth/register', payload)
  const token = getTokenFromPayload(res.data)

  if (token) {
    authStore.accessToken = token
  }

  return res.data
}

export { api, logOut }
