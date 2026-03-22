<template>
  <router-view />
</template>

<script setup lang="ts">
// App root component
</script>

<style>
/* Disable pull-to-refresh globally */
html, body {
  overscroll-behavior-y: contain;
}
</style>