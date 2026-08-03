<template>
  <div class="index-page">
    <el-card style="max-width: 480px">
        <template #header>
        <div class="card-header">
            <span>{{ props?.article?.title || '' }}</span>
        </div>
        </template>
        <span>
            {{ props?.article?.summary }}
        </span>
        <template #footer>
        <div class="article-foot">
            {{ props?.article?.author || '匿名' }}  
            <span class="article-foor-split">|</span>
            <span class="article-foot-data">
                <span>
                    <el-icon 
                        @click="(e) => onCollection(e)" 
                        :style="{ color: props?.article.isCollected ? '#f7ba2a' : ''}" 
                        :class="{ iconClick: !!props?.article.isCollected }"
                        >
                        <Star />
                    </el-icon> 
                    {{ props.article.collection }}
                </span>
                <span>
                    <el-icon>
                        <View />
                    </el-icon> 
                    {{ props.article.view }}
                </span>
            </span>
        </div>
        </template>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { collection } from '../../../api/article';
const props = defineProps(['article'])

const emit = defineEmits(['updateCollection'])

const onCollection = (e: Event) => {
    // 收藏/取消收藏
    collection(props.article.id).then(() => {
        // 修改前端数据
        emit('updateCollection', props.article.isCollected ? -1 : 1)
    })
    e.stopPropagation()
}

</script>

<style scoped>
.index-page :deep(.el-card) {
    border: none;
    border-bottom: 1px solid #e4e6eb80;
    max-width: unset !important;
}
.index-page :deep(.el-card):hover{
    background-color: #e4e6eb80;
    cursor: pointer;
}
.index-page :deep(.el-card__header), :deep(.el-card__footer), :deep(.el-card__body) {
  padding: 8px;
  border-bottom: none;
  border-top: none;
}
.index-page :deep(.el-card__header){
    padding: 0 8px !important;
    font-weight: 600;
    color: #252933;
    white-space: nowrap;
    text-overflow: ellipsis;
}
.index-page :deep(.el-card__body) {
    font-size: 13px;
}
.index-page :deep(.el-card__body) span{
    display: -webkit-box;
    -webkit-line-clamp: 2;   /* 显示两行 */
    -webkit-box-orient: vertical;
    overflow: hidden;
    text-overflow: ellipsis;
    word-break: break-word;  /* 长单词或URL强制换行 */
    min-width: 0;
    color: #8a919f;
}
.index-page .article-foot {
    display: flex;
    font-size: 13px;
    align-items: center;
    color: #8a919f;
}
.index-page .article-foot .article-foor-split {
    color: #e4e6eb;
    margin: 0 6px;
}
.index-page .article-foot .article-foot-data {
    display: flex;
    gap: 12px;
}
.index-page .article-foot .el-icon{
    position: relative;
    top: 2px;
}
.iconClick {
    cursor: pointer;
}
</style>