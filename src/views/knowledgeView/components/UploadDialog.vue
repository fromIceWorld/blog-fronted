<script setup lang="ts">
import { ref, computed } from 'vue'
import { ElMessage } from 'element-plus'
import { UploadFilled } from '@element-plus/icons-vue'
import { uploadDocument } from '@/api/documents';

const props = defineProps<{
  visible: boolean
}>()

const emit = defineEmits<{
  (e: 'update:visible', val: boolean): void
  (e: 'uploaded', documentId: string): void
}>()

const dialogVisible = computed({
  get: () => props.visible,
  set: (val) => emit('update:visible', val),
})

const title = ref('')
const inputMode = ref<'text' | 'file'>('text')
const textContent = ref('')
const fileContent = ref('')
const fileName = ref('')
const uploading = ref(false)

function onFileChange(file: any) {
  const raw = file.raw as File
  if (raw.size > 5 * 1024 * 1024) {
    ElMessage.error('文件超过 5MB')
    return
  }
  const reader = new FileReader()
  reader.onload = () => {
    fileContent.value = reader.result as string
    fileName.value = raw.name
    if (!title.value) {
      // 自动填标题（文件名去掉扩展名）
      title.value = raw.name.replace(/\.[^.]+$/, '')
    }
  }
  reader.readAsText(raw)
}

async function onSubmit() {
  const text =
    inputMode.value === 'text' ? textContent.value : fileContent.value
  if (!text.trim()) {
    ElMessage.warning('内容不能为空')
    return
  }
  if (!title.value.trim()) {
    ElMessage.warning('请填写标题')
    return
  }

  uploading.value = true
  try {
    const raw: any = await uploadDocument({
      title: title.value.trim(),
      text,
    })

    console.log('[upload] raw response:', raw)   // ★ 临时诊断日志

    // ★ 兼容多种返回结构：直接返回 / axios 原生 / 嵌套 data
    const documentId: string | undefined =
      raw?.documentId ?? raw?.data?.documentId ?? raw?.id ?? raw?.data?.id

    if (!documentId) {
      console.error('[upload] 响应里拿不到 documentId，原始响应:', raw)
      ElMessage.error('上传成功但未拿到文档 ID，请联系管理员')
      return
    }

    ElMessage.success('上传成功，正在后台处理')
    emit('uploaded', documentId)

    // 重置表单
    title.value = ''
    textContent.value = ''
    fileContent.value = ''
    fileName.value = ''
  } catch (err: any) {
    ElMessage.error(err.message ?? '上传失败')
  } finally {
    uploading.value = false
  }
}

function onClose() {
  if (uploading.value) return
  dialogVisible.value = false
}
</script>

<template>
  <el-dialog
    v-model="dialogVisible"
    title="上传文档"
    width="640px"
    :close-on-click-modal="false"
    :before-close="onClose"
  >
    <el-form :model="{ title, inputMode }" label-width="72px">
      <el-form-item label="标题" required>
        <el-input
          v-model="title"
          placeholder="文档标题，如「DOM Range 使用指南」"
          maxlength="200"
          show-word-limit
        />
      </el-form-item>

      <el-form-item label="内容" required>
        <el-tabs v-model="inputMode" class="upload-tabs">
          <el-tab-pane label="粘贴文本" name="text">
            <el-input
              v-model="textContent"
              type="textarea"
              :rows="14"
              placeholder="粘贴 Markdown / 纯文本内容..."
            />
          </el-tab-pane>

          <el-tab-pane label="上传文件" name="file">
            <el-upload
              drag
              :auto-upload="false"
              :on-change="onFileChange"
              :limit="1"
              accept=".md,.markdown,.txt"
              class="file-upload"
            >
              <el-icon class="el-icon--upload"><UploadFilled /></el-icon>
              <div class="el-upload__text">
                拖拽文件到这里，或 <em>点击选择</em>
              </div>
              <template #tip>
                <div class="el-upload__tip">
                  支持 .md / .markdown / .txt，最大 5MB
                  <span v-if="fileName" class="file-name">
                    已选择：{{ fileName }}
                  </span>
                </div>
              </template>
            </el-upload>
          </el-tab-pane>
        </el-tabs>
      </el-form-item>
    </el-form>

    <template #footer>
      <el-button @click="onClose" :disabled="uploading">取消</el-button>
      <el-button type="primary" :loading="uploading" @click="onSubmit">
        上传
      </el-button>
    </template>
  </el-dialog>
</template>

<style scoped lang="scss">
.upload-tabs {
  width: 100%;
}

.file-upload {
  width: 100%;
}

.file-name {
  margin-left: 8px;
  color: #409eff;
}
</style>