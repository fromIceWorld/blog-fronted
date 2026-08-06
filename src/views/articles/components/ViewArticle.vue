<template>
    <div class="view-article-container">
        <!-- 点赞，查看，收藏等信息 -->
        <div class="article-additional">
            <el-badge :value="articleInfo.collection" color="#d3cece">
                <el-button 
                    :icon="Star" 
                    circle 
                    @click="onCollection"
                    :class="{'active-collect': articleInfo.isCollected }"
                ></el-button>
            </el-badge>
            <el-badge :value="articleInfo.commentCount" color="#d3cece">
                <el-button :icon="ChatSquare" circle @click="viewComment"></el-button>
            </el-badge>
        </div>
        <div class="article-conetnt">
            <div id="vditor-area"></div>
            <el-empty v-if="!articleInfo.id" :image-size="200" description="无文章信息"/>
        </div>
        <div class="article-menu">其他信息</div>
        <el-drawer
            v-model="isDrawerOpen"
            :title="'评论 · ' + articleInfo.commentCount"
            size="400"
        >
            <CustomComment :articleId="articleInfo.id" :isDisplay="isDrawerOpen"></CustomComment>
        </el-drawer>
    </div>
</template>
<script setup lang="ts">
import { Star, ChatSquare } from '@element-plus/icons-vue';
import { useRoute } from 'vue-router';
import { collection, getArticleDetailById, logArticleView } from '../../../api/article';
import { onMounted, ref, watch } from 'vue';
import Vditor from 'vditor';
import { ElMessage } from 'element-plus';
import type { ArticleInfo } from '../../../types/article';
import CustomComment from '../../../components/CustomComment.vue';
const isDrawerOpen = ref(false)


const createDefaultArticleInfo: () => ArticleInfo = () => {
  return {
    content: '',
    collection: 0,
    isCollected: false,
    like: 0,
    dislike: 0,
    commentCount: 0,
    id: '',
  };
}

const route = useRoute()
const articleInfo = ref(createDefaultArticleInfo())

const onCollection = () => {
     // 收藏/取消收藏
    collection(articleInfo.value.id).then((res: any) => {
        const isCollected = articleInfo.value.isCollected
        // 修改前端数据
        articleInfo.value.isCollected = !isCollected
        articleInfo.value.collection = res.data || 0
    })
}

const requestArticleInfo = () => {
    if(route.params.id) {
        getArticleDetailById(route.params.id as string).then((res: any) => {
            if(res.code === 404) {
                ElMessage.warning(res.message || '文章不存在')
                articleInfo.value = createDefaultArticleInfo()
                return
            }
            console.log('res', res)
            console.log(res)
            const article = res.data
            articleInfo.value = article
            // 使用 Vditor 的预览方法，它会自动生成带样式的 HTML
            Vditor.preview(document.getElementById('vditor-area'), articleInfo.value.content, {
                // 可选：配置主题等，默认会继承编辑器的样式
            });
        })
    }

}

console.log('route', route)
onMounted(() => {
    console.log(route)
    if(route.params.id) {
        requestArticleInfo()
        // 记录用户查看
        logArticleView(route.params.id as string)
    }
})

const viewComment = () => {
    console.log('viewComment')
    isDrawerOpen.value = true
}

watch(() => route.params.id, () => {
    requestArticleInfo()
    logArticleView(route.params.id as string)
})

</script>
<style scoped>
.view-article-container {
    display: flex;
    gap: 10px;
    margin-top: 10px;
    .article-conetnt {
        flex: 1;
        min-width: 0; 
        background-color: white;
        padding: 0 20px;
        min-height: calc(100vh - 80px);
    }
    .article-additional {
        display: flex;
        gap: 18px;
        flex-direction: column;
        align-items: center;
        width: 48px;
        flex-shrink: 0; /* 核心代码：禁止收缩 */
        padding-top: 16px;
        button {
            margin-left: 0;
        }
        .active-collect {
            color: red;
        }
    }
    .article-menu {
        width: 200px;
        flex-shrink: 0; /* 核心代码：禁止收缩 */
    }
}

</style>
<style>
.view-article-container {
    .el-drawer__header {
        margin-bottom: 0;
    }
}
</style>