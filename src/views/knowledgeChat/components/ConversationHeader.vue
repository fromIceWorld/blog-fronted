<template>
  <header class="conv-header">
    <span class="conv-state">{{ stateLabel }}</span>
  </header>
</template>

<script setup lang="ts">
defineProps<{ stateLabel: string }>()
</script>

<style scoped lang="scss">
.conv-header {
  display: flex;
  align-items: center;
  padding: 8px 16px;
  border-bottom: 1px solid var(--ds-border-subtle);
  height: 36px;
  position: fixed;
  top: 0;
  width: stretch;
  background-color: white;
  z-index: 100;
}

.conv-state {
  font-size: 12px;
  color: var(--ds-text-tertiary);
}
</style>