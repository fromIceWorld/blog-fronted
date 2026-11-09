<template>
    <el-card>
        <template #header>
          <div class="card-header">
            <span>热榜🔥</span>
          </div>
        </template>
        <p v-for="(article, index) in hotList" :key="article.article_id" class="text item">
            <el-link :type="switchHotStyle(index)" @click="go(article.article_id)">{{ article.article_title }}</el-link>
        </p>
      </el-card>
</template>
<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { getHotList } from '../api/article';
import router from '../router';

const hotList = ref<any[]>([])

const requestHotList = () =>{
    getHotList(30).then((res: any) => {
        hotList.value = res
    })
}

const go = (id: string) => {
    router.push(`/articles/view-article/${id}`)
}

onMounted(() => {
    requestHotList()
})

const switchHotStyle = (index: number) => {
    let style = ''
    switch(index) {
        case 0:
            style = 'danger'
            break;
        case 1:
        case 2:
            style = 'warning'
            break;
        case 3:
        case 4:
        case 5:
            style = 'success'
            break;
        default:
            style = 'info'
    }
    return style
}

</script>
<style scoped>
.el-card {
    border: none;
    box-shadow: none;
}
</style>