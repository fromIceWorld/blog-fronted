<template>
    <el-menu
        :default-active="defaultActive"
    >
        <el-menu-item 
          v-for="menu in menus" 
          :key="menu.id"
          :index="menu.id">
            <el-icon><component :is="menu.icon" /></el-icon>
            <span>{{ menu.name }}</span>
        </el-menu-item>
    </el-menu>
</template>
<script setup>
import { reactive, ref } from 'vue';

    const defaultActive = ref('default')
    const menus = reactive([
        {
            id: 'default',
            name: '综合',
            icon: 'Compass'
        },
        {
            id: 'fronted',
            name: '前端',
            icon: 'Monitor'
        },
         {
            id: 'backend',
            name: '后端',
            icon: 'Coin'
        },
    ])
</script>
<style>
.el-menu {
    border-right: none;
}
</style>