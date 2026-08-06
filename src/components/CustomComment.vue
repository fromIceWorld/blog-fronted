<template>
 <div class="comment">
   <!-- 一级评论输入框 -->
   <div class="comment-header">
     <div class="comment-header-input-area">
        <el-avatar :src="avatarUrl" size="small" @click="handleAvatarClick"></el-avatar>
        <el-input
            v-model="newComment"
            placeholder="请输入评论..."
            type="textarea"
            maxlength="150"
            ></el-input>
     </div>
     <el-button type="primary" @click="addComment">发表评论</el-button>
   </div>
   <!-- 评论列表 -->
    <div v-for="(comment, index) in comments" :key="comment.id" class="comment-item">
        <custom-el-comment :comment="comment">
            <template #actions="slotProps">
                <div class="comment-actions" >
                    <el-popover
                        :title="slotProps?.reply"
                        placement="bottom"
                        trigger="click"
                        width="300"
                        popper-class="replay-popover"
                        :ref="(el) => popoverRefs[slotProps?.reply] = el"
                    >
                        <el-input
                            v-model="comment.replyContent"
                            placeholder="请输入回复..."
                            type="textarea"
                            maxlength="150"
                        ></el-input>
                        <el-button type="primary" size="small" @click="addReply(index as number, slotProps?.reply, comment.id)">回复</el-button>
                        <template #reference>
                            <el-link 
                                class="reply-btn" 
                                :underline="false"
                                @click="() => openPopover(slotProps?.reply)"
                            >
                                <Edit :icon="Edit"/>
                            </el-link>
                        </template>
                    </el-popover>
                </div>
            </template>
        </custom-el-comment> 
    </div>
    <!-- 触底守卫 -->
    <div class="guard" ref="scrollGuard">
        {{ isLoading ? '加载中...' : '已经到底了' }}
    </div>
 </div>
</template>
<script setup lang="ts">
import { nextTick, onMounted, reactive, ref, useTemplateRef, watch } from 'vue'
import { Edit } from '@element-plus/icons-vue'
import CustomElComment from './CustomElComment.vue'
import { ElMessage, type PopoverInstance } from 'element-plus'
import { createArticleComment, queryArticleComment } from '../api/article.ts'

const pageConfig = ref({
    currentPage: -1,
    pageSize: 20
})

const isLoading = ref(false)
const isFinish = ref(false)

const scrollGuardRef = useTemplateRef('scrollGuard')


const popoverVisible = reactive<Record<number, boolean>>({});


const popoverRefs = ref<any>({})
const replayComment = ref<number>()
const props = defineProps(['articleId', 'isDisplay'])

// --- 响应式数据 ---
const avatarUrl = ref('https://example.com/default-avatar.png')
const newComment = ref('')
const comments = ref<any>([])

// 用于触发文件选择器的 DOM 引用（对应原 this.$refs.avatarInput）
const avatarInput = ref(null)

const openPopover = (replyId: number) => {
    console.log('replyId', replyId)
}

// --- 方法 ---
const addComment = () => {
  if (!newComment.value.trim()) {
    ElMessage.warning('评论内容不能为空！')
    return
  }
  const params = {
    articleId: props.articleId,
    comment: newComment.value
  }
  //  创建评论
  createArticleComment(params).then(res => {
    const { replayId } = res.data
    if(replayId === null) {
        comments.value.unshift(res.data)
    } else {
        const replayComment = comments.value.find((comment: any) => comment.id === replayId)
        // 判断回复的评论层级：
        replayComment.children.unshift(res.data)
        console.log('replayComment', replayComment)
    }
  })
}

// 回复
const addReply = (index: number, replayId: number, commentId: number) => {
  const replyContent = comments.value[index].replyContent
  if (!replyContent?.trim()) {
    ElMessage.warning('回复内容不能为空！')
    return
  }
  const params = {
    articleId: props.articleId,
    replayId,
    comment: replyContent
  }
  //  创建评论
  createArticleComment(params).then(res => {
    const replies = comments.value[index].children
    const Index = replies.findIndex((comment: any) => comment.id === replayId)
    // 判断回复的评论层级：
    replies.splice(Index + 1, 0, res.data)
    // UI状态恢复
    comments.value[index].replyContent = ''
    popoverRefs.value[replayId].hide();

  })
}

const likeComment = (index) => {
  comments.value[index].likes++
}

const deleteComment = (index) => {
  comments.value.splice(index, 1)
}

const isOwner = (comment) => {
  return comment.username === '当前用户'
}

const handleAvatarClick = () => {
  // 触发隐藏的文件选择器
  avatarInput.value?.click()
}

// 如果需要处理头像上传，可补充此方法（原逻辑未实现）
const uploadAvatar = (event) => {
  const file = event.target.files[0]
  if (file) {
    // 此处可执行上传逻辑，并更新 avatarUrl.value
    // 例如：const url = URL.createObjectURL(file) 或上传后返回地址
  }
}

const loadMoreComments = () => {
  pageConfig.value.currentPage += 1
  requestComment()
}

const requestComment = () => {
    if(isFinish.value) {
    return
   }
    queryArticleComment({
        articleId: props.articleId,
        ...pageConfig.value
    }).then(res => {
        const { list, total } = res.data
        comments.value.push(...(list || []))
        if(!list.length) {
            isFinish.value = true
        }
    })
}

const createIntersectionObserver = () => {
  const intersection = new IntersectionObserver((entries) => {
    if (entries[0].intersectionRatio <= 0) return;
    loadMoreComments()
  })
  scrollGuardRef.value && intersection.observe(scrollGuardRef.value)
}

onMounted(() => {
  createIntersectionObserver()
})

// watch(() => [props.isDisplay], () => {
//     if(props.isDisplay) {
//         requestComment()
//     }
// }, {
//     immediate: true
// })

</script>
<style scoped lang="scss">

.comment-header {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
 :deep(.el-textarea) {
    flex: 1;
 }
 .comment-header-input-area {
    display: flex;
    gap: 4px;
    width: 100%;
 }
 .el-button {
    margin-top: 10px;
    width: 100px;
 }
}
.comment-user-info {
    display: flex;
    gap: 8px;
    flex: 1;
}
.replay-comment {
    padding-left: 28px;
}
.comment-actions {
    :deep(.el-link__inner) {
        width: 12px;
    }
}
.reply-box {
 margin-top: 10px;
 .el-button {
    margin-top: 10px;
    float: right;
 }
}
.reply-item {
 margin-left: 20px;
 margin-top: 10px;
}
.reply-btn {
    font-size: 12px;
}
</style>
<style lang="scss">
.replay-popover {
    .el-button {
        margin-top: 10px;
        float: right;
    }
}
.guard {
    text-align: center;
    padding-top: 10px;
    font-size: 12px;
    color: #8a919f;
}
</style>