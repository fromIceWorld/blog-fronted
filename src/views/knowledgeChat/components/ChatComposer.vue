<template>
  <footer class="bottom-composer">
    <div class="composer-box">
      <el-input
        v-model="input"
        type="textarea"
        :autosize="{ minRows: 1, maxRows: 6 }"
        resize="none"
        placeholder="输入你的回答..."
        :disabled="disabled || loading"
        @keydown.enter.exact.prevent="onSend"
      />
      <div class="composer-actions">
        <!-- <el-button
          v-if="canSkip"
          text
          size="small"
          :disabled="loading"
          @click="emit('skip')"
        >
          跳过
        </el-button> -->
        <span  />
        <el-button
          type="primary"
          circle
          :loading="loading"
          :disabled="disabled || !input.trim()"
          @click="onSend"
        >
          <el-icon v-if="!loading"><Promotion /></el-icon>
        </el-button>
      </div>
    </div>
  </footer>
</template>

<script setup lang="ts">
import { Promotion } from '@element-plus/icons-vue'

const input = defineModel<string>({ default: '' })

const props = defineProps<{
  disabled: boolean
  loading: boolean
  canSkip: boolean
}>()

const emit = defineEmits<{
  send: []
  skip: []
}>()

function onSend(e: KeyboardEvent) {
  if (e.isComposing || e.keyCode === 229) return
  if (props.disabled || props.loading || !input.value.trim()) return
  emit('send')
}
</script>

<style scoped lang="scss">
.bottom-composer {
  padding: 0 var(--ds-conversation-padding) 16px  24px;
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
}

.composer-box {
  margin: 0 auto;
  background: var(--ds-bg-panel);
  border: 1px solid var(--ds-border-default);
  border-radius: var(--ds-radius-lg);
  padding: 12px 12px 8px;
  transition: border-color 0.15s;
  box-shadow: var(--ds-shadow-input);

  &:focus-within {
    border-color: var(--ds-brand);
  }

  :deep(.el-textarea__inner) {
    border: none;
    box-shadow: none;
    padding: 4px 8px;
    font-size: 15px;
    line-height: 1.6;
    font-family: inherit;
    background: transparent;

    &:focus {
      box-shadow: none;
    }
  }
}

.composer-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 4px 4px 0;
  margin-top: 4px;
}
</style>