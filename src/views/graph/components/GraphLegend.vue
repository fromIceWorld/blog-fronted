<script setup lang="ts">
import { ref } from 'vue'

const collapsed = ref(false)
</script>

<template>
  <div class="legend" :class="{ collapsed }">
    <div class="legend-header" @click="collapsed = !collapsed">
      <span>图例</span>
      <span class="toggle">{{ collapsed ? '▲' : '▼' }}</span>
    </div>
    <div v-show="!collapsed" class="legend-body">
      <!-- ============================================================
           领域（节点填充色）
           ============================================================ -->
      <div class="group">
        <div class="group-title">领域（节点颜色）</div>
        <div class="item">
          <span class="fill-swatch" style="background: #4E79A7"></span>
          JS / 主要领域
        </div>
        <div class="item">
          <span class="fill-swatch" style="background: #F28E2B"></span>
          网络 / 其他领域
        </div>
        <div class="item muted">
          <span class="hint">不同颜色 = 不同领域</span>
        </div>
      </div>

      <!-- ============================================================
           掌握程度（节点描边色）
           ============================================================ -->
      <div class="group">
        <div class="group-title">掌握程度（节点边框）</div>
        <div class="item">
          <span class="stroke-swatch" style="border-color: rgba(148, 163, 184, 0.7)"></span>
          未开始
        </div>
        <div class="item">
          <span class="stroke-swatch" style="border-color: rgba(245, 158, 11, 0.9)"></span>
          学习中
        </div>
        <div class="item">
          <span class="stroke-swatch" style="border-color: rgba(59, 130, 246, 0.9)"></span>
          较熟练
        </div>
        <div class="item">
          <span class="stroke-swatch" style="border-color: rgba(16, 185, 129, 0.95)"></span>
          已掌握
        </div>
      </div>

      <!-- ============================================================
           关系
           ============================================================ -->
      <div class="group">
        <div class="group-title">关系（连线）</div>
        <div class="item">
          <span class="line solid"></span>
          包含（层级）
        </div>
        <div class="item">
          <span class="line dashed red"></span>
          导致
        </div>
        <div class="item">
          <span class="line dashed blue"></span>
          适用于
        </div>
        <div class="item">
          <span class="line dashed purple"></span>
          对比
        </div>
        <div class="item">
          <span class="line dashed green"></span>
          示例
        </div>
      </div>

      <!-- ============================================================
           特殊节点
           ============================================================ -->
      <div class="group">
        <div class="group-title">特殊节点</div>
        <div class="item">
          <span class="star-swatch"></span>
          父概念（含子节点）
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.legend {
  position: absolute;
  left: 16px;
  bottom: 16px;
  background: rgba(255, 255, 255, 0.96);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(15, 23, 42, 0.08);
  border-radius: 10px;
  box-shadow: 0 4px 20px rgba(15, 23, 42, 0.08);
  padding: 12px 14px;
  min-width: 180px;
  font-size: 12px;
  z-index: 10;
}

.legend.collapsed {
  min-width: auto;
  padding: 8px 12px;
}

.legend-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  cursor: pointer;
  font-weight: 600;
  font-size: 12px;
  color: #1f2937;
  user-select: none;
}

.toggle {
  margin-left: 16px;
  font-size: 10px;
  color: #94a3b8;
}

.legend-body {
  margin-top: 10px;
}

.group {
  margin-bottom: 10px;

  &:last-child {
    margin-bottom: 0;
  }
}

.group-title {
  font-size: 11px;
  color: #94a3b8;
  margin-bottom: 6px;
  font-weight: 500;
}

.item {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
  color: #374151;
  line-height: 1.4;

  &.muted {
    opacity: 0.65;
  }
}

.hint {
  font-size: 10px;
  color: #94a3b8;
  font-style: italic;
}

/* ============================================================
   领域：实心方块
   ============================================================ */
.fill-swatch {
  display: inline-block;
  width: 12px;
  height: 12px;
  border-radius: 3px;
  flex-shrink: 0;
}

/* ============================================================
   掌握程度：白底 + 彩色边框（对应画布的叶子节点）
   ============================================================ */
.stroke-swatch {
  display: inline-block;
  width: 12px;
  height: 12px;
  border-radius: 3px;
  background: #ffffff;
  border: 2px solid;
  flex-shrink: 0;
}

/* ============================================================
   关系：线段
   ============================================================ */
.line {
  display: inline-block;
  width: 18px;
  height: 0;
  border-top: 2px solid #94a3b8;
  flex-shrink: 0;

  &.dashed {
    border-top-style: dashed;
  }

  &.dashed.red {
    border-color: #ef4444;
  }
  &.dashed.blue {
    border-color: #3b82f6;
  }
  &.dashed.purple {
    border-color: #a855f7;
  }
  &.dashed.green {
    border-color: #22c55e;
  }
}

/* ============================================================
   父概念：琥珀星
   ============================================================ */
.star-swatch {
  display: inline-block;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #fbbf24;
  box-shadow: 0 0 0 2px rgba(245, 158, 11, 0.35);
  flex-shrink: 0;
  position: relative;

  /* 用伪元素画个小星芒 */
  &::after {
    content: '';
    position: absolute;
    inset: 3px;
    background: #fffbeb;
    border-radius: 50%;
  }
}
</style>