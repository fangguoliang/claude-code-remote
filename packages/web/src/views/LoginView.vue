<template>
  <div class="login-container">
    <div class="login-card">
      <h1>CCremote</h1>
      <p>远程 PowerShell 终端</p>
      <form @submit.prevent="handleLogin">
        <div class="form-group">
          <label>用户名</label>
          <input v-model="username" type="text" required autocomplete="username" />
        </div>
        <div class="form-group">
          <label>密码</label>
          <input v-model="password" type="password" required autocomplete="current-password" />
        </div>
        <button type="submit" :disabled="loading">{{ loading ? '登录中...' : '登录' }}</button>
        <p v-if="error" class="error">{{ error }}</p>
      </form>
      <router-link to="/settings" class="settings-link">设置</router-link>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import { useSettingsStore } from '../stores/settings';

const router = useRouter();
const authStore = useAuthStore();
const settingsStore = useSettingsStore();

const username = ref('');
const password = ref('');
const loading = ref(false);
const error = ref('');

async function handleLogin() {
  loading.value = true;
  error.value = '';
  try {
    await authStore.login(username.value, password.value, settingsStore.settings.apiUrl);
    router.push('/terminal');
  } catch (e) {
    error.value = (e as Error).message;
  } finally {
    loading.value = false;
  }
}
</script>

<style scoped>
.login-container { display: flex; justify-content: center; align-items: center; min-height: 100vh; background: #1a1a2e; }
.login-card { background: #16213e; padding: 2rem; border-radius: 8px; width: 100%; max-width: 400px; }
.login-card h1 { color: #e94560; margin-bottom: 0.5rem; }
.login-card p { color: #a0a0a0; margin-bottom: 1.5rem; }
.form-group { margin-bottom: 1rem; }
.form-group label { display: block; color: #e0e0e0; margin-bottom: 0.5rem; }
.form-group input { width: 100%; padding: 0.75rem; border: 1px solid #333; border-radius: 4px; background: #1a1a2e; color: #fff; }
button { width: 100%; padding: 0.75rem; background: #e94560; color: #fff; border: none; border-radius: 4px; cursor: pointer; font-size: 1rem; }
button:disabled { opacity: 0.6; }
.error { color: #e94560; margin-top: 1rem; }
.settings-link { display: block; text-align: center; margin-top: 1rem; color: #a0a0a0; }
</style>