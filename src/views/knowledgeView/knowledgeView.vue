<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { authStore, clearAccessToken, logOut } from '@/api/auth'

const route = useRoute()
const router = useRouter()

const activeMenu = computed(() => route.path)

function goBackToBlog() {
  router.push('/articles/main')
}

async function handleUserCommand(command: string) {
  switch (command) {
    case 'person':
      router.push('/person')
      break
    case 'logout':
      await loginOut()
      break
  }
}

async function loginOut() {
  try {
    const res: any = await logOut()
    clearAccessToken()
    router.push('/login')
    ElMessage.success(res?.message || '退出登陆')
  } catch (err: any) {
    console.error(err)
  }
}

// ============================================================
// 悬浮球：跳转对话页 + 拖动
// ============================================================
const BALL_SIZE = 52
const EDGE_GAP = 16
const DRAG_THRESHOLD = 4
const STORAGE_KEY = 'knowledge-float-ball-pos'
const SNAP_DURATION = 250   // 与 CSS .is-snapping transition 时长对齐

const pos = reactive({ x: 0, y: 0 })   // 左上角坐标
const isDragging = ref(false)
const isSnapping = ref(false)          // 仅吸附瞬间为 true，用于临时挂 left/top transition

let moved = false
let startX = 0
let startY = 0
let originX = 0
let originY = 0
let snapTimer: number | null = null

const ballStyle = computed(() => ({
  left: `${pos.x}px`,
  top: `${pos.y}px`,
}))

const tooltipPlacement = computed(() =>
  pos.x + BALL_SIZE / 2 < window.innerWidth / 2 ? 'right' : 'left',
)

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v))
}

function getDefaultPos() {
  return {
    x: window.innerWidth - BALL_SIZE - EDGE_GAP * 2,
    y: window.innerHeight - BALL_SIZE - EDGE_GAP * 2,
  }
}

function loadPos() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const p = JSON.parse(raw) as { x: number; y: number }
      pos.x = clamp(p.x, 0, window.innerWidth - BALL_SIZE)
      pos.y = clamp(p.y, 0, window.innerHeight - BALL_SIZE)
      return
    }
  } catch {
    /* ignore */
  }
  const d = getDefaultPos()
  pos.x = d.x
  pos.y = d.y
}

function savePos() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ x: pos.x, y: pos.y }))
  } catch {
    /* ignore */
  }
}

// 关键：setup 顶层同步初始化，保证首帧 inline style 就是终态，不会产生"变化"
if (typeof window !== 'undefined') {
  loadPos()
}

function onPointerDown(e: PointerEvent) {
  if (e.button !== 0 && e.pointerType === 'mouse') return

  // 中断进行中的吸附动画，避免继续位移
  if (snapTimer !== null) {
    window.clearTimeout(snapTimer)
    snapTimer = null
    isSnapping.value = false
  }

  isDragging.value = true
  moved = false
  startX = e.clientX
  startY = e.clientY
  originX = pos.x
  originY = pos.y
  document.addEventListener('pointermove', onPointerMove)
  document.addEventListener('pointerup', onPointerUp)
  document.addEventListener('pointercancel', onPointerUp)
}

function onPointerMove(e: PointerEvent) {
  const dx = e.clientX - startX
  const dy = e.clientY - startY
  if (!moved && Math.hypot(dx, dy) > DRAG_THRESHOLD) moved = true
  if (!moved) return
  pos.x = clamp(originX + dx, 0, window.innerWidth - BALL_SIZE)
  pos.y = clamp(originY + dy, 0, window.innerHeight - BALL_SIZE)
}

function onPointerUp() {
  if (!isDragging.value) return
  isDragging.value = false
  document.removeEventListener('pointermove', onPointerMove)
  document.removeEventListener('pointerup', onPointerUp)
  document.removeEventListener('pointercancel', onPointerUp)

  if (moved) {
    // 只在吸附这一刻开 transition
    isSnapping.value = true

    const cx = pos.x + BALL_SIZE / 2
    pos.x = cx < window.innerWidth / 2
      ? EDGE_GAP
      : window.innerWidth - BALL_SIZE - EDGE_GAP
    pos.y = clamp(pos.y, EDGE_GAP, window.innerHeight - BALL_SIZE - EDGE_GAP)
    savePos()

    if (snapTimer !== null) window.clearTimeout(snapTimer)
    snapTimer = window.setTimeout(() => {
      isSnapping.value = false
      snapTimer = null
    }, SNAP_DURATION + 70)
  }
}

function onBallClick() {
  // 拖拽结束后的 click 忽略
  if (moved) return
  goToChat()
}

function goToChat() {
  router.push({ path: '/chat/topic-practice' })
}

function onResize() {
  pos.x = clamp(pos.x, 0, window.innerWidth - BALL_SIZE)
  pos.y = clamp(pos.y, 0, window.innerHeight - BALL_SIZE)
}

onMounted(() => {
  // setup 顶层已初始化，这里不再重复 loadPos（避免触发二次赋值）
  window.addEventListener('resize', onResize)
})

onUnmounted(() => {
  window.removeEventListener('resize', onResize)
  document.removeEventListener('pointermove', onPointerMove)
  document.removeEventListener('pointerup', onPointerUp)
  document.removeEventListener('pointercancel', onPointerUp)
  if (snapTimer !== null) {
    window.clearTimeout(snapTimer)
    snapTimer = null
  }
})
</script>

<template>
  <div class="knowledge-view">
    <el-page-header class="knowledge-page-header" @back="goBackToBlog">
      <template #title>
        <span class="back-title">返回博客</span>
      </template>

      <template #content>
        <el-menu
          mode="horizontal"
          :router="true"
          :default-active="activeMenu"
          :ellipsis="false"
          class="knowledge-menu"
        >
          <el-menu-item index="/knowledge/questions">题目</el-menu-item>
          <el-menu-item index="/knowledge/graph">图谱</el-menu-item>
          <el-menu-item index="/knowledge/threads">答题记录</el-menu-item>
          <el-menu-item index="/knowledge/mastery">掌握度</el-menu-item>
          <el-menu-item index="/knowledge/documents">文档</el-menu-item>
          <el-menu-item index="/trace">日志</el-menu-item>
        </el-menu>
      </template>

      <template #extra>
        <div class="extra-actions">
          <el-divider direction="vertical" class="header-divider" />
          <el-dropdown trigger="click" @command="handleUserCommand">
            <el-avatar
              :size="32"
              src="https://cube.elemecdn.com/0/88/03b0d39583f48206768a7534e55bcpng.png"
              class="user-avatar"
            />
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="person">个人中心</el-dropdown-item>
                <el-dropdown-item command="logout" divided>退出</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </template>
    </el-page-header>

    <div class="knowledge-body">
      <router-view v-slot="{ Component }">
        <keep-alive>
          <component :is="Component" />
        </keep-alive>
      </router-view>
    </div>

    <!-- ============================================================ -->
    <!-- 可拖动悬浮球：跳转对话页 -->
    <!-- ============================================================ -->
    <el-tooltip
      content="去对话"
      :placement="tooltipPlacement"
      :show-after="400"
      :disabled="isDragging"
    >
      <button
        type="button"
        class="float-ball"
        :class="{ 'is-dragging': isDragging, 'is-snapping': isSnapping }"
        :style="ballStyle"
        aria-label="去对话"
        @pointerdown="onPointerDown"
        @click="onBallClick"
      >
        <svg
          viewBox="0 0 24 24"
          width="22"
          height="22"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      </button>
    </el-tooltip>
  </div>
</template>

<style lang="scss">
.header-menu {
  padding: 8px 0 !important;
  .el-menu-item {
    height: 32px;
  }
}
</style>

<style scoped lang="scss">
.knowledge-view {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: #f5f5f5;
}

/* ============================================================
   顶栏
   ============================================================ */
.knowledge-page-header {
  height: 60px;
  padding: 0 24px;
  background: #fff;
  border-bottom: 1px solid #f0f0f0;
  flex-shrink: 0;

  :deep(.el-page-header__header) {
    height: 100%;
    padding: 0;
    display: flex;
    align-items: center;
  }

  :deep(.el-page-header__left) {
    display: flex;
    align-items: center;
    flex-shrink: 0;
    flex: 1;

    .el-page-header__back {
      display: flex;
      align-items: center;
      font-size: 14px;
      color: #606266;

      &:hover {
        color: #409eff;
      }
    }
  }

  :deep(.el-page-header__content) {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: flex-end;
    min-width: 0;
    padding: 0;
    margin-right: 0;
  }

  :deep(.el-page-header__extra) {
    flex-shrink: 0;
    display: flex;
    align-items: center;
  }
}

.back-title {
  font-size: 14px;
  color: #606266;
}

.knowledge-menu {
  border-bottom: none !important;
  background: transparent;

  :deep(.el-menu-item) {
    height: 60px;
    line-height: 60px;
    font-size: 14px;
    padding: 0 20px;

    &.is-active {
      border-bottom: 2px solid #409eff;
    }
  }
}

.extra-actions {
  display: flex;
  align-items: center;
}

.header-divider {
  height: 20px;
  margin: 0 16px;
  border-color: #e5e5e5;
}

.user-avatar {
  cursor: pointer;
  transition: transform 0.2s;

  &:hover {
    transform: scale(1.05);
  }
}

.knowledge-body {
  flex: 1;
  overflow: hidden;
  position: relative;
}

/* ============================================================
   可拖动悬浮球
   ============================================================ */
.float-ball {
  position: fixed;
  z-index: 1000;

  width: 52px;
  height: 52px;
  border-radius: 50%;
  border: none;
  padding: 0;

  display: inline-flex;
  align-items: center;
  justify-content: center;

  color: #fff;
  background: linear-gradient(135deg, #409eff, #6aa9ff);
  box-shadow: 0 6px 16px rgba(64, 158, 255, 0.35),
              0 2px 6px rgba(0, 0, 0, 0.08);

  cursor: grab;
  user-select: none;
  touch-action: none; /* 移动端禁止拖动触发页面滚动 */

  /* ★ 常态只过渡 transform / box-shadow，不含 left / top
         —— 首帧不会"从左上滑到目标位置" */
  transition: transform 0.2s ease, box-shadow 0.2s ease;

  &:hover {
    transform: scale(1.05);
    box-shadow: 0 10px 24px rgba(64, 158, 255, 0.45),
                0 4px 10px rgba(0, 0, 0, 0.1);
  }

  &:active {
    transform: scale(0.98);
  }

  /* 呼吸光晕 */
  &::before {
    content: '';
    position: absolute;
    inset: -6px;
    border-radius: 50%;
    background: rgba(64, 158, 255, 0.25);
    z-index: -1;
    pointer-events: none;
    animation: float-pulse 2.4s ease-out infinite;
  }

  /* 拖拽态：位置实时跟随，无过渡 */
  &.is-dragging {
    cursor: grabbing;
    transition: transform 0.2s ease, box-shadow 0.2s ease;
    transform: scale(1.08);
    box-shadow: 0 12px 28px rgba(64, 158, 255, 0.5),
                0 4px 12px rgba(0, 0, 0, 0.12);

    &::before {
      animation: none;
      opacity: 0;
    }
  }

  /* ★ 吸附态：只在这一刻挂上 left/top 的平滑过渡 */
  &.is-snapping {
    transition:
      left 0.25s cubic-bezier(0.22, 1, 0.36, 1),
      top 0.25s cubic-bezier(0.22, 1, 0.36, 1),
      transform 0.2s ease,
      box-shadow 0.2s ease;
  }
}

@keyframes float-pulse {
  0%   { transform: scale(0.85); opacity: 0.7; }
  70%  { transform: scale(1.35); opacity: 0; }
  100% { transform: scale(1.35); opacity: 0; }
}

@media (max-width: 768px) {
  .float-ball {
    width: 46px;
    height: 46px;
  }
}
</style>