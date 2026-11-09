<template>
  <div class="ai-chat-page">
    <Header />

    <div class="chat-container">
      <main class="chat-main">
        <div id="vditor-chat-preview" ref="previewEl" class="vditor-chat-preview"></div>
      </main>

      <div class="composer">
        <textarea v-model="input" @keydown.enter.prevent="send" placeholder="输入消息，Shift+Enter 换行，回车发送" :disabled="isSending"></textarea>
        <button class="btn-send" :disabled="isSending" @click="send" :aria-busy="isSending" :title="isSending ? '发送中' : '发送'">
          <template v-if="isSending">
            <svg class="icon spinner" viewBox="0 0 50 50" width="18" height="18" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="25" cy="25" r="20" stroke="currentColor" stroke-width="4" stroke-opacity="0.25" />
              <path d="M45 25a20 20 0 0 0-20-20" stroke="currentColor" stroke-width="4" stroke-linecap="round" />
            </svg>
          </template>
          <template v-else>
            <svg class="icon send-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M2 21l21-9L2 3v7l15 2-15 2v7z" fill="currentColor" />
            </svg>
          </template>
        </button>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { ref, nextTick, onMounted, onBeforeUnmount } from 'vue'
import Header from '../common/Header.vue'
import Vditor from 'vditor'
import 'vditor/dist/index.css'
import { mastraClient } from '../api/mastra.ts'

type Message = { role: 'user' | 'assistant'; text: string }

const client = ref()
const subscription = ref()
const messages = ref<Message[]>([
  { role: 'assistant', text: '你好，我是 AI 聊天助手。想聊点什么？' },
])

// 流式输出状态
const accumulated = ref('')
const currentAssistantMsg = ref('') // 当前正在生成的助手消息
const currentMsgId = ref<string | null>(null) // 当前消息ID
const isStreaming = ref(false) // 是否正在流式输出

const previewEl: any = ref<HTMLElement | null>(null)
const input = ref('')
const isSending = ref(false)

function escapeHtml(str: string) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

// 渲染累积内容到 Vditor
async function renderAccumulated() {
  if (!previewEl.value) {
    previewEl.value = document.getElementById('vditor-chat-preview') as HTMLElement
  }
  if (!previewEl.value) return
  
  try {
    // 使用 Vditor 的预览功能渲染 Markdown
    Vditor.preview(previewEl.value, accumulated.value, {
      mode: 'dark', 
      // 可以添加自定义渲染配置
      hljs: {
        style: 'github',
      },
    })
  } catch (e) {
    // 如果 Vditor 渲染失败，降级为纯文本
    previewEl.value.innerText = accumulated.value
  }
  
  await nextTick()
  // 滚动到底部
  const container = previewEl.value?.parentElement as HTMLElement
  if (container) {
    container.scrollTop = container.scrollHeight
  }
}

// 渲染消息列表
function renderMessages() {
  // 构建包含所有消息的 HTML
  let html = ''
  
  messages.value.forEach((msg, index) => {
    if (msg.role === 'assistant') {
      html += `<div class="assistant-msg">${escapeHtml(msg.text)}</div>\n`
    } else {
      html += `<div class="user-msg-container"><div class="user-msg">${escapeHtml(msg.text)}</div></div>\n`
    }
  })
  
  // 如果有正在流式输出的消息，添加到末尾
  if (isStreaming.value && currentAssistantMsg.value) {
    html += `<div class="assistant-msg streaming">${escapeHtml(currentAssistantMsg.value)}<span class="cursor-blink">▍</span></div>\n`
  }
  
  accumulated.value = html
  renderAccumulated()
}

// 添加用户消息
function addUserMessage(text: string) {
  messages.value.push({ role: 'user', text })
  renderMessages()
}

// 开始新的助手消息
function startAssistantMessage() {
  currentMsgId.value = `msg-${Date.now()}`
  currentAssistantMsg.value = ''
  isStreaming.value = true
  // 不立即添加到 messages，等流式完成后添加
  renderMessages()
}

// 更新助手消息内容（流式追加）
function appendAssistantText(text: string) {
  if (!isStreaming.value) {
    startAssistantMessage()
  }
  currentAssistantMsg.value += text
  renderMessages()
}

// 完成助手消息
function finishAssistantMessage() {
  if (currentAssistantMsg.value) {
    // 将流式消息保存到消息列表
    messages.value.push({ 
      role: 'assistant', 
      text: currentAssistantMsg.value 
    })
  }
  
  // 重置流式状态
  isStreaming.value = false
  currentAssistantMsg.value = ''
  currentMsgId.value = null
  
  renderMessages()
}

// 添加系统消息（工具调用等）
function addSystemMessage(text: string) {
  // 可以以特殊样式显示系统消息
  accumulated.value += `\n<div class="system-msg">🔧 ${escapeHtml(text)}</div>`
  renderAccumulated()
}

// 错误处理
function handleError(error: string) {
  const errorMsg = `❌ 发生错误: ${error}`
  
  if (isStreaming.value) {
    // 如果正在流式输出，添加错误信息到当前消息
    currentAssistantMsg.value += `\n\n---\n**错误**: ${error}`
    renderMessages()
  } else {
    // 否则作为新消息显示
    accumulated.value += `\n<div class="assistant-msg error">${escapeHtml(errorMsg)}</div>`
    renderAccumulated()
  }
}

// 创建订阅
const createSubscribe = async () => {
  try {
    subscription.value = await client.value.subscribeToThread({
      resourceId: 'user-123',
      threadId: 'thread-456',
    })
    
    // 开始持续监听流式数据
    subscription.value.processDataStream({
      onChunk: async (chunk: any) => {
        console.log('收到 chunk:', chunk.type, chunk)
        
        switch (chunk.type) {
          case 'text-delta': {
            // 收到文本增量块 - 逐字输出
            const text = chunk.payload.text || ''
            if (text) {
              if (!isStreaming.value) {
                startAssistantMessage()
              }
              appendAssistantText(text)
            }
            break
          }
          
          case 'text-end': {
            // 文本输出完成
            finishAssistantMessage()
            break
          }
          
          case 'tool-call': {
            // 智能体调用工具
            const { toolName, args, toolCallId } = chunk.payload || {}
            const toolInfo = `正在使用工具: ${toolName || '未知工具'}`
            addSystemMessage(toolInfo)
            console.log('🔧 工具调用:', toolName, args, toolCallId)
            break
          }
          
          case 'tool-result': {
            // 工具执行完成
            const { toolName, result } = chunk.payload || {}
            const resultInfo = `工具 ${toolName || '未知工具'} 执行完成`
            addSystemMessage(resultInfo)
            console.log('✅ 工具结果:', toolName, result)
            break
          }
          
          case 'background-task-started': {
            // 后台任务开始
            const { taskId } = chunk.payload || {}
            addSystemMessage(`后台任务开始: ${taskId}`)
            break
          }
          
          case 'background-task-completed': {
            // 后台任务完成
            const { taskId, result } = chunk.payload || {}
            addSystemMessage(`后台任务完成: ${taskId}`)
            break
          }
          
          case 'error': {
            // 流式错误
            const errorMsg = chunk.payload?.error || '未知错误'
            console.error('流式错误:', errorMsg)
            handleError(errorMsg)
            break
          }
          
          default: {
            // 处理其他类型的数据块
            console.log('未处理的 chunk 类型:', chunk.type, chunk)
            
            // 如果 chunk 有文本内容，尝试显示
            if (chunk.payload?.text) {
              if (!isStreaming.value) {
                startAssistantMessage()
              }
              appendAssistantText(chunk.payload.text)
            }
          }
        }
      },
      reconnect: true, // 自动重连
    })
    
    console.log('✅ 订阅创建成功')
  } catch (error) {
    console.error('❌ 创建订阅失败:', error)
    accumulated.value += `\n<div class="assistant-msg error">❌ 连接失败: ${error instanceof Error ? error.message : '未知错误'}</div>`
    await renderAccumulated()
  }
}

onMounted(() => {
  client.value = mastraClient.getAgent('weather-agent')
  
  // 初始化渲染
  accumulated.value = `<div class="assistant-msg">${escapeHtml(messages.value[0].text)}</div>`
  renderAccumulated()
  
  // 创建订阅
  createSubscribe()
})

// 组件卸载时清理
onBeforeUnmount(() => {
  // 如果有订阅，可以取消
  if (subscription.value) {
    // 某些实现可能提供取消方法
    // subscription.value.unsubscribe?.()
  }
})

// 发送消息
async function send() {
  const text = input.value?.trim()
  if (!text || isSending.value) return

  // 添加用户消息
  addUserMessage(text)
  input.value = ''

  isSending.value = true
  
  try {
    // 发送消息到智能体
    await client.value.sendMessage({
      message: text,
      resourceId: 'user-123',
      threadId: 'thread-456',
    })
    
    // 注意：响应会通过 subscribeToThread 的 processDataStream 回调处理
    console.log('✅ 消息发送成功')
    
  } catch (error) {
    console.error('❌ 发送失败:', error)
    const errorMsg = error instanceof Error ? error.message : '发送失败，请稍后再试'
    handleError(errorMsg)
  } finally {
    isSending.value = false
  }
}

// 清空对话
function clearChat() {
  messages.value = [{ role: 'assistant', text: '对话已清空，有什么可以帮你的？' }]
  currentAssistantMsg.value = ''
  isStreaming.value = false
  currentMsgId.value = null
  renderMessages()
}
</script>

<style scoped>
.ai-chat-page { background: #f4f6f8; min-height: 100vh; }
.chat-container { max-width:920px; margin: 6px; background: #fff; border-radius:10px; box-shadow:0 6px 20px rgba(15,23,42,0.06); display:flex; flex-direction:column; height: calc(100vh - 74px); }

.chat-main { padding:20px; flex:1; overflow:auto; }
.messages { list-style:none; padding:0; margin:0; display:flex; flex-direction:column; gap:12px; }
.message { display:flex; gap:12px; align-items:flex-end; width:100%; }
.message.assistant { justify-content:flex-start; }
.message.user { justify-content:flex-end; }

.avatar { width:36px; height:36px; border-radius:50%; background:#e6f2ff; display:flex; align-items:center; justify-content:center; color:#0369a1; font-weight:700; font-size:13px; flex-shrink:0; }
.message.user .avatar { background:#2563eb; color:#fff }

.bubble-wrap { max-width:72%; display:flex; }
.bubble { padding:12px 14px; border-radius:12px; line-height:1.5; border:1px solid rgba(15,23,42,0.04); }
.message.assistant { justify-content:flex-start; }
.message.assistant .avatar { order:0 }
.message.assistant .bubble-wrap { order:1; margin-right:auto }
.message.user { justify-content:flex-end }
.message.user .avatar { order:1 }
.message.user .bubble-wrap { order:0; margin-left:auto }

.composer { position:relative; padding:12px; }
.composer textarea { width:100%; min-height:100px; max-height:160px; resize:none; padding:12px 14px; padding-right:80px; border-radius:8px; background:#fff; color:#0f172a; border:1px solid #e6eef6; outline:none; }
.composer textarea::placeholder { color:#9aa7b2 }
.btn-send { position:absolute; right:18px; bottom:24px;  color:#2563eb; border:none; padding:2px; border-radius:6px; cursor:pointer; font-weight:600; font-size:13px; height:30px; width: 30px; display:flex; align-items:center; justify-content:center }
.btn-send:active { transform:translateY(1px) }
.btn-send:disabled { opacity:0.7; cursor:default }
.icon { display:block }
.spinner { animation: spin 1s linear infinite }


@keyframes spin { to { transform: rotate(360deg) } }
.markdown-preview { background:#f8fafc; color:#0f172a; padding:12px 14px; border-radius:12px; border:1px solid rgba(15,23,42,0.04); max-width:72%; }
.message.user .markdown-preview { background: transparent }

@media (max-width:640px) {
  .chat-container { margin:10px; height: calc(100vh - 76px); }
  .avatar { width:30px; height:30px }
  .btn-send { 
    right: 18px;
        bottom: 23px;
        padding: 6px 8px;
        height: 26px;
        font-size: 12px; }
}

/* 流式输出光标动画 */
.cursor-blink {
  animation: blink 0.8s step-end infinite;
  color: #2563eb;
  font-weight: bold;
}

@keyframes blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0; }
}

/* 助手消息样式 */
.assistant-msg {
  margin: 10px 0;
  padding: 8px 12px;
  background: #f8fafc;
  border-radius: 12px;
  border-left: 3px solid #2563eb;
  line-height: 1.6;
}

/* 流式输出中的消息 */
.assistant-msg.streaming {
  border-left-color: #60a5fa;
  background: #f0f7ff;
}

/* 错误消息 */
.assistant-msg.error {
  border-left-color: #ef4444;
  background: #fef2f2;
  color: #dc2626;
}

/* 系统消息 */
.system-msg {
  margin: 6px 0;
  padding: 4px 12px;
  background: #f1f5f9;
  border-radius: 8px;
  color: #64748b;
  font-size: 13px;
  text-align: center;
  border: 1px dashed #cbd5e1;
}

/* 用户消息已有样式，保持不变 */

/* 预览区域的滚动优化 */
.vditor-chat-preview {
  padding: 8px 4px;
  min-height: 100%;
}

/* Markdown 内容样式优化 */
.vditor-chat-preview .vditor-reset {
  font-size: 14px;
  line-height: 1.6;
}

.vditor-chat-preview .vditor-reset pre {
  background: #f1f5f9;
  border-radius: 6px;
  padding: 12px;
  margin: 8px 0;
  overflow-x: auto;
}

.vditor-chat-preview .vditor-reset code {
  font-family: 'SF Mono', 'Menlo', 'Monaco', 'Consolas', monospace;
  font-size: 13px;
  background: #f1f5f9;
  padding: 2px 6px;
  border-radius: 4px;
}

.vditor-chat-preview .vditor-reset blockquote {
  border-left: 4px solid #2563eb;
  margin: 8px 0;
  padding: 8px 16px;
  background: #f8fafc;
}
</style>
<style>
.user-msg-container {
    display: flex;
    flex-direction: row-reverse;
}
.user-msg {
    border-radius: 12px;
    margin: 10px 0 10px 40px;
    padding: 6px 12px;
    background-color: #f4f4f4;
}
</style>