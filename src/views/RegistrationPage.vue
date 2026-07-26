<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { register } from '../api/auth'
import type { FormInstance, FormRules } from 'element-plus'
import { ElMessage } from 'element-plus'

const router = useRouter()

const accountFormRef = ref<FormInstance>()
const submitBtnLoading = ref(false)

const accountForm = reactive({
  username: '',
  password: '',
  confirmPassword: '',
  email: '',
  phone: '',
})

const accountRules: FormRules = {
  username: [
    { required: true, message: '请输入账号', trigger: 'blur' },
  ],
  password: [
    { required: true, message: '请输入密码', trigger: 'blur' },
    { min: 6, message: '密码至少6位', trigger: 'blur' },
  ],
  confirmPassword: [
    { required: true, message: '请确认密码', trigger: 'blur' },
    {
      validator: (_rule: any, value: string, callback: any) => {
        if (value !== accountForm.password) callback(new Error('两次输入的密码不一致'))
        else callback()
      },
      trigger: 'blur',
    },
  ],
  email: [
    { type: 'email', message: '请输入有效邮箱地址', trigger: 'blur', required: false },
  ],
  phone: [
    { pattern: /^\d{6,20}$/, message: '请输入有效手机号，必须为数字', trigger: 'blur', required: false },
  ],
}

async function submitAuth(formEl: FormInstance | undefined) {
  if (!formEl) return
  submitBtnLoading.value = true

  await formEl.validate(async (valid: any, fields: any) => {
    if (valid) {
      try {
        const payload: any = {
          username: accountForm.username,
          password: accountForm.password,
        }
        if (accountForm.email) payload.email = accountForm.email
        if (accountForm.phone) payload.phone = accountForm.phone

        await register(payload)
        ElMessage({ message: '注册成功', type: 'success' })
        router.replace('/articles')
      } catch (error: any) {
        ElMessage({ message: error?.response?.data?.message || '注册失败，请检查接口', type: 'error' })
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
      <span>注册</span>
    </template>

    <el-form 
        :label-position="'right'"
        label-width="auto" 
        ref="accountFormRef" 
        :model="accountForm" 
        :rules="accountRules">
      <el-form-item label="账号" prop="username">
        <el-input v-model="accountForm.username" placeholder="请输入账号" />
      </el-form-item>

      <el-form-item label="密码" prop="password">
        <el-input v-model="accountForm.password" type="password" placeholder="请输入密码" />
      </el-form-item>

      <el-form-item label="确认密码" prop="confirmPassword">
        <el-input v-model="accountForm.confirmPassword" type="password" placeholder="请再次输入密码" />
      </el-form-item>

      <el-form-item label="邮箱" prop="email">
        <el-input v-model="accountForm.email" placeholder="请输入邮箱（可选）" />
      </el-form-item>

      <el-form-item label="手机号" prop="phone">
        <el-input v-model="accountForm.phone" placeholder="请输入手机号（可选）" />
      </el-form-item>
    </el-form>

    <el-button type="primary" :loading="submitBtnLoading" class="submit-btn" @click="submitAuth(accountFormRef)">注册</el-button>
    <el-link type="primary" @click="router.push('/login')">已有账号？去登录</el-link>
  </el-card>
</template>

<style scoped>
.account-container {
  width: 420px;
  margin: 120px auto;
  padding: 20px;
}
.account-container :deep(.el-card__header) {
  padding: 10px;
  font-size: 20px;
}
.submit-btn {
  width: 100%;
  margin-top: 10px;
  margin-bottom: 6px;
}
</style>
