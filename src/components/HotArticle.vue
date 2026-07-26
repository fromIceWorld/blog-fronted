<template>
    <el-card>
        <template #header>
          <div class="card-header">
            <span>热榜🔥</span>
          </div>
        </template>
        <p v-for="o in 4" :key="o" class="text item">{{ 'List item ' + o }}</p>
        <template #footer>
            <el-link underline="never">
                查看更多
                <el-icon ><ArrowRight /></el-icon>
            </el-link>
        </template>
      </el-card>
</template>
<script setup>
</script>
<style scoped>
.el-card {
    border: none;
    box-shadow: none;
}
</style>