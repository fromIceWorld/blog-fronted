<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { login } from '../api/auth'
import type { FormInstance, FormRules } from 'element-plus'
import { ElMessage } from 'element-plus'

const router = useRouter()

const accountFormRef = ref<FormInstance>()

const submitBtnLoading = ref(false)

const accountForm = reactive({
  username: '',
  password: '',
})

const accountRules: FormRules = {
  username: [
    { required: true, message: '请输入账号', trigger: 'blur' },
  ],
  password: [
    { required: true, message: '请输入密码', trigger: 'blur' },
  ],
}

async function submitAuth(formEl: FormInstance | undefined) {
  if (!formEl) return
  submitBtnLoading.value = true

  await formEl.validate(async (valid: any, fields: any) => {
    if (valid) {
        try {
          const payload = {
            username: accountForm.username, password: accountForm.password
          }

          const res = await login(payload)
          if (res.token || res.accessToken || res.data?.token) {
            ElMessage({
              message: `登录成功`,
              type: 'success',
            })
            router.replace('/articles')
          } else {
            ElMessage({
              message: `登录失败`,
              type: 'error',
            })
          }
        } catch (error: any) {
          ElMessage({
              message: error?.response?.data?.message || '登录失败，请检查接口',
              type: 'error',
            })
        } finally {
          submitBtnLoading.value = false
        }
    } else {
        submitBtnLoading.value = false
        console.log('error submit!', fields)
    }
  })

}
</script>

<template>
  <el-card class="account-container">
    <template #header>
      <span>登陆</span>
    </template>
    <el-form  ref="accountFormRef" :model="accountForm" :rules="accountRules">
      <el-form-item label="账号" prop="username">
        <el-input v-model="accountForm.username" placeholder="请输入账号" />
      </el-form-item>
      <el-form-item label="密码" prop="password">
        <el-input v-model="accountForm.password" type="password" placeholder="请输入密码" />
      </el-form-item>
      </el-form>
      <el-button type="primary" :loading="submitBtnLoading" class="submit-btn" @click="submitAuth(accountFormRef)">登陆</el-button>
      <el-link type="primary"  @click="router.push('/register')">无账号?去注册</el-link>

  </el-card>
</template>

<style scoped>
.account-container {
  width: 400px;
  margin: 200px auto;
  padding: 20px;
}
.account-container :deep(.el-card__header) {
  padding: 10px;
  font-size: 20px;
}
.account-container :deep(.el-card__body) {
  padding-top: 30px;
}
.submit-btn {
  width: 100%;
  margin-top: 10px;
  margin-bottom: 6px;

}
</style>
