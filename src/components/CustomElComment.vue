<template>
  <div class="comment-user-data">
    <div class="comment-user-info">
      <el-avatar :src="comment.avatarUrl" size="small"></el-avatar>
      <div class="comment-user-title">
        <span class="comment-user-name">
            {{ comment.username }} 
            <span v-if="comment.replyUserId"><el-icon><CaretRight /></el-icon> {{ comment.replyUserName }}</span>
            <span class="comment-user-time">{{ comment.createTime }}</span>
        </span>
        <span class="comment-user-comment">{{ comment.comment }}</span>
        <!-- 外部传入的 actions 插槽，作用域为当前 comment -->
        <slot name="actions" :reply="comment.id"></slot>
      </div>
    </div>
    <!-- 子回复列表：递归渲染 -->
    <div v-if="comment.children && comment.children.length" class="comment-replies">
      <div v-for="reply in comment.children" :key="reply.id">
        <CustomElComment :comment="reply">
            <template  #actions="scope">
                <slot name="actions" v-bind="scope"  />
            </template>
        </CustomElComment>
    </div>
    </div>
  </div>
</template>
<script lang="ts" setup>
defineOptions({ name: 'CustomElComment' })  // 必须！

const { comment } = defineProps(['comment'])


</script>
<style lang="scss" scoped>
.comment-user-title {
    display: flex;
    flex: 1;
    flex-direction: column;
}
.comment-user-data {
    display: flex;
    padding: 10px 0;
    flex-direction: column;
}
.comment-user-info {
    display: flex;
    gap: 8px;
    flex: 1;
}
.comment-replies {
    padding-left: 30px;
}
.comment-user-name {
    display: flex;
    color: #00000073;
    font-size: 12px;
    .comment-user-time {
        margin-left: auto;
    }
    :deep(.el-icon) {
        font-size: 12px;
        position: relative;
        top: 2px;
    }
}
.comment-user-comment {
    font-size: 14px;
}
</style>