<template>
    <el-menu
        :default-active="defaultActive"
    >
        <el-menu-item 
          v-for="(menu, index) in menus" 
          :key="menu.id"
          :index="String(index)">
            <el-icon><component :is="menu.icon" /></el-icon>
            <span>{{ menu.name }} {{ menu.count }}</span>
        </el-menu-item>
    </el-menu>
</template>
<script setup>
import { onMounted, reactive, ref } from 'vue';
import { getAllTags } from '../api/article';
const defaultActive = ref('default')
const menus = ref([
    {
        id: 'default',
        name: '综合',
        count: '',
        icon: 'Compass'
    },
    {
        id: 1,
        name: 'web',
        count: 0,
        icon: 'Monitor'
    },
        {
        id: 2,
        name: 'node',
        count: 0,
        icon: 'Coin'
    },
])

const queryTags = () => {
    getAllTags().then(res => {
        console.log('tags', res)
        const tags = res.data || []
        const nameMapCount = new Map();
        tags.forEach(tag => {
            nameMapCount.set(tag.name, tag.articleCount);
        })
        menus.value = menus.value.map(menu => ({
            ...menu,
            count: nameMapCount.get(menu.name) || ''
        }))
    })
}

onMounted(() => {
    queryTags()
})

</script>
<style>
.el-menu {
    border-right: none;
}
</style>