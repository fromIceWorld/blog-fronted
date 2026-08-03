<template>
    <div class="mian-page">
        <Header />
        <div class="body-container">
            <RouterView></RouterView>
        </div>
    </div>
</template>
<script lang="ts" setup>
import Header from '../common/Header.vue'

</script>