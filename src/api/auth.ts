import { reactive } from 'vue'
import axios, { AxiosHeaders, type InternalAxiosRequestConfig } from 'axios'
import { ElMessage } from 'element-plus'

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

// ============ 全局状态 ============
let isRefreshing = false;
let lastRefreshTime = 0;
const REFRESH_COOLDOWN = 1000;

type PendingRequest = {
  resolve: (value: any) => void;
  reject: (reason?: any) => void;
  config: RetryableRequestConfig;
};
let pendingRequests: PendingRequest[] = [];

// ============ 请求拦截器 ============
api.interceptors.request.use((config) => {
  const requestConfig = config as RetryableRequestConfig;

  // 登录和刷新接口直接放行
  if (
    requestConfig.url?.includes('/auth/login') ||
    requestConfig.url?.includes('/auth/refresh')
  ) {
    return requestConfig;
  }

  // @ts-ignore 🔥 如果是重发队列中的请求，直接放行（避免死循环）
  if (requestConfig.__fromQueue) {
    return requestConfig;
  }

  // 正常请求：带上 token
  if (authStore.accessToken) {
    setAuthorizationHeader(requestConfig, authStore.accessToken);
  }

  return requestConfig;
});

// ============ 响应拦截器 ============
api.interceptors.response.use(
  (response) => {
    console.log('interceptors response', response);
    return response.data;
  },
  async (error) => {
    const originalRequest = error.config as RetryableRequestConfig | undefined;
    if (!originalRequest || !error.response) {
      return Promise.reject(error);
    }

    const isLoginRequest = originalRequest.url?.includes('/auth/login');
    const isRefreshRequest = originalRequest.url?.includes('/auth/refresh');

    if (isLoginRequest) {
      return Promise.reject(error);
    }

    if (isRefreshRequest) {
      clearSessionState();
      redirectToLogin();
      return Promise.reject(error);
    }

    // 404
    if(error.response.status === 404) {
      return Promise.resolve({
        code: 404,
        message: error?.response?.data?.message || '不存在'
      })
    } 

    // 非 401 或已重试过，直接拒绝
    if (error.response.status !== 401 || originalRequest.__isRetry) {
      return Promise.reject(error.response.data);
    }



    // 🔥 冷却期判断：如果刚刷新过，直接用最新 token 重试
    const now = Date.now();
    if (now - lastRefreshTime < REFRESH_COOLDOWN) {
      console.log('♻️ 冷却期内遇到 401，直接重试:', originalRequest.url);
      const token = authStore.accessToken;
      if (token) {
        const retryConfig = { ...originalRequest, __isRetry: true, __fromQueue: true };
        setAuthorizationHeader(retryConfig, token);
        return await api.request(retryConfig);
      }
      clearSessionState();
      redirectToLogin();
      return Promise.reject(error);
    }

    // 如果已经在刷新中，当前请求入队
    if (isRefreshing) {
      console.log('📥 刷新中，401 请求入队:', originalRequest.url);
      return new Promise((resolve, reject) => {
        pendingRequests.push({ resolve, reject, config: originalRequest });
      })
    }

    // ============ 开始刷新 ============
    isRefreshing = true;

    try {
      const newToken = await refreshAccessToken();

      lastRefreshTime = Date.now();
      console.log('✅ 刷新成功，新 token 已获取');

      // 1. 处理所有挂起的请求（用新 token 重发）
      const queue = [...pendingRequests];
      pendingRequests = [];
      queue.forEach(({ resolve, reject, config }) => {
        const retryConfig = { ...config, __isRetry: true, __fromQueue: true };
        setAuthorizationHeader(retryConfig, newToken);
        // 重发请求，将结果传回给原始 promise
        api.request(retryConfig).then(resolve).catch(reject);
      });

      // 2. 重试当前触发刷新的请求
      const retryConfig = { ...originalRequest, __isRetry: true, __fromQueue: true };
      setAuthorizationHeader(retryConfig, newToken);
      return await api.request(retryConfig);
    } catch (refreshError) {
      console.error('❌ 刷新失败', refreshError);
      const queue = [...pendingRequests];
      pendingRequests = [];
      queue.forEach(({ reject }) => reject(refreshError));
      clearSessionState();
      redirectToLogin();
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
      console.log('🔓 刷新流程结束，状态重置');
    }
  }
);

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
   return api.post<{code: number, message: string}>('/auth/logout')
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
