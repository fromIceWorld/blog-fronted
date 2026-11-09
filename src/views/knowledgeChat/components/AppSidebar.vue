<template>
  <aside class="sidebar" :class="{ collapsed }">
    <!-- 第一行：折叠 + 场景 -->
    <div class="sidebar-top">
      <el-dropdown
        v-if="!collapsed"
        trigger="click"
        placement="bottom-start"
        @command="onSwitchMode"
      >
        <div class="mode-trigger">
          <span class="mode-name">{{ activeModeName }}</span>
          <el-icon class="mode-arrow"><ArrowDown /></el-icon>
        </div>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item
              v-for="mode in modes"
              :key="mode.id"
              :command="mode.id"
              :disabled="mode.id === activeMode"
            >
              {{ mode.name }}
            </el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
      <div class="icon-btns">
        <button class="icon-btn" @click="goQuestions()">
          <el-icon>
            <HomeFilled/>
          </el-icon>
        </button>
        <button class="icon-btn" @click="emit('toggle')">
          <el-icon>
            <Fold v-if="!collapsed" />
            <Expand v-else />
          </el-icon>
        </button>
      </div>
    </div>
    
    <!-- 第二行：开启新对话 -->
    <div class="sidebar-actions">
      <button
        class="new-chat-btn"
        :class="{ 'icon-only': collapsed }"
        @click="emit('new-session')"
      >
        <el-icon><Plus /></el-icon>
        <span v-if="!collapsed">开启新对话</span>
      </button>
    </div>

    <!-- 历史会话（分组） -->
    <nav v-if="!collapsed" class="sidebar-nav">
      <div v-if="sessions.length === 0" class="nav-empty">暂无历史</div>

      <template v-else>
        <div v-for="group in sessionGroups" :key="group.key" class="nav-group">
          <div class="nav-group-title">{{ group.label }}</div>
          <div class="nav-list">
            <div
              v-for="s in group.items"
              :key="s.id"
              class="nav-item"
              :class="{ active: s.id === currentSessionId }"
              @click="onSwitchSession(s.id)"
            >
              <div class="nav-item-title">{{ s.preview }}</div>
              <div class="nav-item-time">{{ formatTime(s.lastActiveAt) }}</div>
            </div>
          </div>
        </div>
      </template>
    </nav>
  </aside>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { ArrowDown, Expand, Fold, Plus } from '@element-plus/icons-vue'
import type { ChatMode, ChatModeId, SessionListItem } from '@/api/knowledge'
import router from '@/router';

const props = defineProps<{
  modes: ChatMode[]
  activeMode: ChatModeId
  collapsed: boolean
  sessions: SessionListItem[]
  currentSessionId: string
}>()

const emit = defineEmits<{
  toggle: []
  'switch-mode': [modeId: ChatModeId]
  'new-session': []
  'switch-session': [id: string]
}>()

const goQuestions = () => {
  router.push({ path: '/knowledge/questions' })
}

const activeModeName = computed(
  () => props.modes.find((m) => m.id === props.activeMode)?.name ?? '主题练习',
)

function onSwitchMode(modeId: string) {
  emit('switch-mode', modeId as ChatModeId)
}

function onSwitchSession(id: string) {
  if (id === props.currentSessionId) return
  emit('switch-session', id)
}

// ============================================================
// 分组
// ============================================================

interface SessionGroup {
  key: string
  label: string
  items: SessionListItem[]
}

const DAY = 86_400_000

const sessionGroups = computed<SessionGroup[]>(() => {
  const now = new Date()
  // 本地时区的今天 0 点
  const todayStart = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  ).getTime()
  const sevenDaysAgo = todayStart - 7 * DAY
  const thirtyDaysAgo = todayStart - 30 * DAY

  // 组内按 lastActiveAt 倒序（不依赖后端排序）
  const sorted = [...props.sessions].sort((a, b) => {
    const ta = new Date(a.lastActiveAt || a.createdAt).getTime()
    const tb = new Date(b.lastActiveAt || b.createdAt).getTime()
    return tb - ta
  })

  const groups = new Map<string, SessionGroup>()
  const monthKeys: string[] = []

  for (const s of sorted) {
    const d = new Date(s.lastActiveAt || s.createdAt)
    const t = d.getTime()

    let key: string
    let label: string

    if (t >= todayStart) {
      key = 'today'
      label = '今日'
    } else if (t >= sevenDaysAgo) {
      key = '7d'
      label = '近 7 天'
    } else if (t >= thirtyDaysAgo) {
      key = '30d'
      label = '近 30 天'
    } else {
      const y = d.getFullYear()
      const m = String(d.getMonth() + 1).padStart(2, '0')
      key = `m:${y}-${m}`
      label = `${y} 年 ${m} 月`
      if (!monthKeys.includes(key)) monthKeys.push(key)
    }

    let g = groups.get(key)
    if (!g) {
      g = { key, label, items: [] }
      groups.set(key, g)
    }
    g.items.push(s)
  }

  // 固定组按 today → 7d → 30d 排序
  const fixed = ['today', '7d', '30d']
    .filter((k) => groups.has(k))
    .map((k) => groups.get(k)!)

  // 月份组按 YYYY-MM 倒序
  const monthly = monthKeys
    .sort()
    .reverse()
    .map((k) => groups.get(k)!)

  return [...fixed, ...monthly]
})

// ============================================================
// 时间格式
// ============================================================

function formatTime(iso: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  const diff = Date.now() - d.getTime()
  if (diff < 60_000) return '刚刚'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} 分钟前`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} 小时前`
  if (diff < 7 * 86_400_000) return `${Math.floor(diff / 86_400_000)} 天前`
  return d.toLocaleDateString()
}
</script>

<style scoped lang="scss">
/* ============================================================
   侧边栏容器
   ============================================================ */
.sidebar {
  width: var(--ds-sidebar-width);
  flex-shrink: 0;
  background: var(--ds-bg-page);
  transition: width 0.2s ease;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding: 8px 0;

  &.collapsed {
    width: var(--ds-sidebar-collapsed-width);
    .sidebar-top {
      justify-content: center;
    }
  }
}

/* ============================================================
   第一行：折叠 + 场景切换
   ============================================================ */
.sidebar-top {
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 4px 8px;
  justify-content: space-between;
}
.icon-btns {
  display: flex;
}
.collapsed {
  .sidebar-top {
      flex-wrap: wrap;
  }
  .icon-btns {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      flex-direction: column-reverse;
  }
}

.icon-btn {
  background: transparent;
  border: none;
  cursor: pointer;
  padding: 8px;
  border-radius: 8px;
  color: var(--ds-text-secondary);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: background 0.15s;

  &:hover {
    background: var(--ds-border-subtle);
  }

  .el-icon {
    font-size: 16px;
  }
}

.mode-trigger {
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 6px 8px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 15px;
  font-weight: 600;
  color: var(--ds-text-primary);
  transition: background 0.15s;
  min-width: 0;

  &:hover {
    background: var(--ds-border-subtle);
  }

  .mode-name {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .mode-arrow {
    font-size: 12px;
    color: var(--ds-text-tertiary);
    flex-shrink: 0;
    margin-top: 1px;
  }
}

/* ============================================================
   第二行：新对话按钮
   ============================================================ */
.sidebar-actions {
  padding: 4px 8px;
}

.new-chat-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 9px 12px;
  background: var(--ds-border-subtle);
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  color: var(--ds-text-primary);
  transition: background 0.15s;
  white-space: nowrap;
  text-align: left;

  &:hover {
    background: var(--ds-border-default);
  }

  .el-icon {
    font-size: 16px;
    flex-shrink: 0;
  }

  &.icon-only {
    padding: 9px;
    justify-content: center;
  }
}

/* ============================================================
   历史会话
   ============================================================ */
.sidebar-nav {
  flex: 1;
  padding: 12px 8px 8px;
  overflow-y: auto;
  min-height: 0;
}

.nav-section-title {
  font-size: 12px;
  color: var(--ds-text-tertiary);
  padding: 4px 12px 8px;
  font-weight: 500;
}

.nav-empty {
  font-size: 13px;
  color: var(--ds-text-tertiary);
  padding: 8px 12px;
}

/* 分组 */
.nav-group + .nav-group {
  margin-top: 12px;
}

.nav-group-title {
  font-size: 12px;
  color: var(--ds-text-tertiary);
  padding: 4px 12px;
  font-weight: 500;
  letter-spacing: 0.02em;
}

.nav-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.nav-item {
  padding: 8px 12px;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.15s;
  min-width: 0;

  &:hover {
    background: var(--ds-border-subtle);
  }

  &.active {
    background: var(--ds-brand-light, #ecf5ff);
    color: var(--ds-brand, #409eff);

    .nav-item-title {
      color: var(--ds-brand, #409eff);
    }
  }
}

.nav-item-title {
  font-size: 13px;
  color: var(--ds-text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.4;
}

.nav-item-time {
  font-size: 11px;
  color: var(--ds-text-tertiary);
  margin-top: 2px;
}
</style>