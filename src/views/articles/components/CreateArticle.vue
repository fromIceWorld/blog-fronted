<script lang="ts" setup>
import Vditor from 'vditor'
import 'vditor/dist/index.css';
import { onMounted, ref } from 'vue';
import { createArticle } from '../../../api/article';
import { ElMessage } from 'element-plus';

const vditor = ref()

const tags = ref([])

const tagNames = [
    {
        value: 1,
        label: 'web',
    },
    {
        value: 2,
        label: 'node',
    },
]


const handleClose = (deleteName: string) => {
    console.log('deleteName', deleteName)
}

onMounted(() => {
    vditor.value = new Vditor('vditor',{
        width: '100%',
        height: '100vh',
    })
})

const submit = async () => {
    try {
        await createArticle({
            content: vditor.value.getValue(),
            tags: tags.value
        })
        ElMessage.success('发布成功')
    } catch (error: any) {
        console.log('error', error)
        ElMessage.error(error?.message.join(',') || '保存失败')
    }
}
</script>
<template>
    <div id="vditor"></div>
    <el-tooltip
        effect="light"
        content="暂存"
        placement="top"
      >
        <el-link 
            icon="Lock" 
            class="article-btn cache-btn" 
            :underline="false" 
            />
    </el-tooltip>
    <el-tooltip
        effect="light"
        content="删除"
        placement="top"
      >
        <el-link 
            icon="Delete" 
            class="article-btn delete-btn" 
            :underline="false" 
        />
    </el-tooltip>
    <el-tooltip
        effect="light"
        content="发布"
        placement="top"
      >
        <el-popover
            placement="top-start"
            title="🏷️ 文章标签"
            :width="400"
            trigger="click"
        >
            <template #reference>
                 <el-link 
                    icon="Position" 
                    class="article-btn submit-btn" 
                    :underline="false" 
                    />
            </template>
            <el-select
                v-model="tags"
                multiple
                placeholder="文章标签"
                style="width: 240px"
                >
                <el-option
                    v-for="item in tagNames"
                    :key="item.value"
                    :label="item.label"
                    :value="item.value"
                />
                </el-select>
            <el-button type="primary" plain size="small" class="submit-button" @click="submit">发布</el-button>
        </el-popover>
    </el-tooltip>
</template>


<style scoped>
.article-btn {
    position: fixed;
    right: 40px;
    font-size: 26px;
}
.delete-btn {
    bottom: 80px;
}
.submit-btn {
  bottom: 40px;
}
.cache-btn {
  bottom: 120px;
}
.submit-button {
    margin-top: 10px;
    width: 100%;
}
</style>