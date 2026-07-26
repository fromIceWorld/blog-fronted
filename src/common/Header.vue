<template>
    <el-row :gutter="20" class="header-container">
        <el-col :span="6" class="header-container-logo">
            <el-image 
                style="width: 100px; " 
                :src="'https://element-plus.org/images/element-plus-logo.svg'" />
        </el-col>
        <el-col :span="6" :offset="12" class="header-container-other">
            <el-popover
                placement="top-start"
                popper-class = "header-menu"
            >
                <template #reference>
                    <el-avatar
                        src="https://cube.elemecdn.com/0/88/03b0d39583f48206768a7534e55bcpng.png"
                    />
                </template>
                <el-menu @select="goWhere">
                    <el-menu-item index="person">个人中心</el-menu-item>
                    <el-menu-item index="logout">退出</el-menu-item>
                </el-menu>
            </el-popover>
            
        </el-col>
    </el-row>
</template>
<script setup lang="ts">
import { useRouter } from 'vue-router'
import { clearAccessToken, logOut } from '../api/auth';
import { ElMessage } from 'element-plus';

const router = useRouter()

const goWhere = (index: string) => {
    switch(index){
        case 'logout': 
            loginOut();
            break;
        default:
            console.log('other')
    }
    console.log(index)
}

const loginOut = () => {
    try{
        logOut().then(res => {
            console.log('logout res', res)
        })
        clearAccessToken()
        router.push('/login')
        ElMessage.success('退出登陆')
    } catch(err: any) {
        console.error(err)
    }
}
</script>
<style scoped>
.header-container {
    height: 60px;
    padding: 0 12px;
    .el-col {
        display: flex;
        align-items: center;
    }
}
.header-container-other {
    flex-direction: row-reverse;
    .el-avatar {
        cursor: pointer;
    }
}
</style>
<style>
.header-menu {
    padding: 8px 0 !important;
    .el-menu-item {
        height: 32px;
    }
}
</style>