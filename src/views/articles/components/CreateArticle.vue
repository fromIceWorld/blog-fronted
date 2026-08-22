<script lang="ts" setup>
import Vditor from 'vditor'
import 'vditor/dist/index.css';
import { onMounted, ref, onBeforeUnmount, nextTick } from 'vue';
import { createArticle } from '../../../api/article';
import { ElMessage } from 'element-plus';

const vditor = ref<any>()

const popoverVisible = ref(false)
const tags = ref<number[]>([])

const tagNames = [
    { value: 1, label: 'web' },
    { value: 2, label: 'node' },
]

const togglePopover = () => {
    popoverVisible.value = !popoverVisible.value
}

// 点击外部关闭 Popover，但排除 Popover 自身、触发按钮以及 Select 下拉菜单
const handleClickOutside = (event: MouseEvent) => {
    if (!popoverVisible.value) return
    const target = event.target as HTMLElement
    // 检查点击是否在 Popover 内部
    if (target.closest('.el-popover')) return
    // 检查点击是否在触发按钮上
    if (target.closest('.submit-btn')) return
    // 检查点击是否在 Select 下拉菜单内（即使 teleported，安全起见保留）
    if (target.closest('.el-select-dropdown')) return
    popoverVisible.value = false
}

onMounted(() => {
    vditor.value = new Vditor('vditor', {
        width: '100%',
        height: '100vh',
    })
    document.addEventListener('click', handleClickOutside)
})

onBeforeUnmount(() => {
    document.removeEventListener('click', handleClickOutside)
})

const submit = async () => {
    try {
        const content = vditor.value?.getValue() || ''
        await createArticle({
            content,
            tags: tags.value,
        })
        ElMessage.success('发布成功')
        popoverVisible.value = false
    } catch (error: any) {
        console.error('error', error)
        ElMessage.error(error?.message?.join?.('、') || '保存失败')
    }
}
</script>

<template>
    <div id="vditor"></div>

    <el-tooltip effect="light" content="暂存" placement="top">
        <el-link icon="Lock" class="article-btn cache-btn" :underline="false" />
    </el-tooltip>
    <el-tooltip effect="light" content="删除" placement="top">
        <el-link icon="Delete" class="article-btn delete-btn" :underline="false" />
    </el-tooltip>
    <el-tooltip effect="light" content="发布" placement="top">
        <span>
            <el-popover
                placement="top-start"
                title="🏷️ 文章标签"
                :width="400"
                trigger="manual"
                v-model:visible="popoverVisible"
                :persistent="true"
            >
                <template #reference>
                    <el-link
                        icon="Position"
                        class="article-btn submit-btn"
                        :underline="false"
                        @click.stop="togglePopover"
                    />
                </template>
                <!-- 使用 div 包裹并阻止冒泡 -->
                <div @click.stop @mousedown.stop>
                    <el-select
                        v-model="tags"
                        multiple
                        placeholder="文章标签"
                        style="width: 240px"
                        :teleported="false"
                        @click.stop
                        @mousedown.stop
                    >
                        <el-option
                            v-for="item in tagNames"
                            :key="item.value"
                            :label="item.label"
                            :value="item.value"
                        />
                    </el-select>
                    <el-button
                        type="primary"
                        plain
                        size="small"
                        class="submit-button"
                        @click.stop="submit"
                    >
                        发布
                    </el-button>
                </div>
            </el-popover>
        </span>
    </el-tooltip>
</template>

<style scoped>
.article-btn {
    position: fixed;
    right: 40px;
    font-size: 26px;
    z-index: 10;
}
.delete-btn { bottom: 80px; }
.submit-btn { bottom: 40px; }
.cache-btn { bottom: 120px; }
.submit-button {
    margin-top: 10px;
    width: 100%;
}
</style>