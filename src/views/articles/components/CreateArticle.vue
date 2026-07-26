<script lang="ts" setup>
import Vditor from 'vditor'
import 'vditor/dist/index.css';
import { onMounted, ref } from 'vue';
import { createArticle } from '../../../api/article';
import { ElMessage } from 'element-plus';

const vditor = ref()

onMounted(() => {
    vditor.value = new Vditor('vditor',{
        width: '100%',
        height: '100vh',
    })
})

const submit = async () => {
    console.log(vditor, vditor.value.getValue())
    const res = await createArticle({
        content: vditor.value.getValue()
    })
    ElMessage.success('发布成功')
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
      <el-link 
        icon="Position" 
        class="article-btn submit-btn" 
        :underline="false" 
        @click = "submit"
        />
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
</style>