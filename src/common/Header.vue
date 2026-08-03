<template>
    <div class="header-container">
        <div class="header-container-logo">
            <el-image 
                @click="goIndex"
                style="width: 100px; cursor: pointer;" 
                :src="'https://element-plus.org/images/element-plus-logo.svg'" />
        </div>
        <div class="header-container-search">
            <el-select 
                filterable
                remote 
                v-model="articleId" 
                :remote-method="remoteRequest"
                :loading="loading"
                popper-class="query-article"
                placeholder="查询文章" 
                style="width: 240px"
                @change="onChange"
            >
                <el-option
                    v-for="item in articleList"
                    :key="item.value"
                    :label="item.name"
                    :value="item.value"
                    >
                    <span class="query-article-title">{{ item.name }}</span>
                    <span class="query-article-content">{{ item.label }}</span>
                    </el-option>
                </el-select>
        </div>
        <div class="header-container-avator">
            <el-popover
                placement="top-start"
                popper-class = "header-menu"
            >
                <template #reference>
                    <el-avatar
                        src="https://cube.elemecdn.com/0/88/03b0d39583f48206768a7534e55bcpng.png"
                    />
                </template>
                <el-menu @select="goWhere">
                    <el-menu-item index="person">个人中心</el-menu-item>
                    <el-menu-item index="logout">退出</el-menu-item>
                </el-menu>
            </el-popover>
            
        </div>
    </div>
</template>
<script setup lang="ts">
import { useRouter } from 'vue-router'
import { clearAccessToken, logOut } from '../api/auth';
import { ElMessage } from 'element-plus';
import { ref } from 'vue';
import { getArticleByQuery } from '../api/article';
import type { Article } from '../types/article';

const router = useRouter()

const loading = ref(false)

const articleId = ref('')
const articleList = ref<Array<{ name: string, label: string, value: number }>>([])

const onChange = (id: number) => {
    router.push(`/articles/view-article/${id}`)
}

const goWhere = (index: string) => {
    switch(index){
        case 'logout': 
            loginOut();
            break;
        default:
            console.log('other')
    }
    console.log(index)
}

const remoteRequest = (query: string) => {
    const pureQuery = query.trim()
    if(pureQuery) {
        console.log('1231')
        getArticleByQuery(pureQuery).then(res => {
            console.log(res)
            articleList.value = (res.data || []).map((article: Article) => ({
                name: article.title,
                label: article.summary,
                value: article.id
            }))
        })
    }
}

const goIndex = () => {
    router.push('/articles/main')
}

const loginOut = () => {
    try{
        logOut().then(res => {
            console.log('logout res', res)
        })
        clearAccessToken()
        router.push('/login')
        ElMessage.success('退出登陆')
    } catch(err: any) {
        console.error(err)
    }
}
</script>
<style lang="scss" scoped>
.header-container {
    height: 60px;
    padding: 0 12px;
    background-color: white;
    position: sticky;
    top: 0;
    z-index: 1000;
    margin-left: unset !important;
    margin-right: unset !important;
    display: flex;
    align-items: center;
    .header-container-logo {
        width: 210px;
    }
    .header-container-search {

    }
    .header-container-avator {
        flex: 1;
        display: flex;
        flex-direction: row-reverse;
    }
}
.header-container-other {
    flex-direction: row-reverse;
    :deep(.el-avatar) {
        cursor: pointer;
    }
}
</style>
<style lang="scss">

.header-menu {
    padding: 8px 0 !important;
    .el-menu-item {
        height: 32px;
    }
}
</style>
<style lang="scss">
.query-article {
    .el-select-dropdown__item {
        display: flex;
        flex-direction: column;
        height: 40px;
    }
    .query-article-title {
        line-height: 20px;
    }
    .query-article-content {
        color: #8a919f;
        line-height: 16px;
        font-size: 10px;
    }
}
</style>