import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    proxy: {
        // /mastra 开头的请求转发到 localhost:3333
        '/mastra': {
          target: 'http://localhost:3333',
          changeOrigin: true,
          secure: false,
          rewrite: (path) => path.replace(/^\/mastra/, ''),

        },
        // 浏览器端对后端常规 API 统一走 /api 前缀并转发到 localhost:9000
        '/api': {
          target: 'http://localhost:9000',
          changeOrigin: true,
          secure: false,
          // 去掉 /api 前缀后再转发给后端
          rewrite: (path) => path.replace(/^\/api/, ''),
        },
      },
}})
