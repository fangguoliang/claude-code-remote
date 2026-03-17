<template>
  <div class="settings-container">
    <div class="settings-card">
      <h1>设置</h1>
      <div class="form-group">
        <label>API 地址</label>
        <input v-model="settings.apiUrl" type="text" />
      </div>
      <div class="form-group">
        <label>主题</label>
        <select v-model="settings.theme">
          <option value="dark">深色</option>
          <option value="light">浅色</option>
        </select>
      </div>
      <div class="form-group">
        <label>字体</label>
        <input v-model="settings.fontFamily" type="text" />
      </div>
      <div class="form-group">
        <label>字号</label>
        <input v-model.number="settings.fontSize" type="number" min="10" max="24" />
      </div>
      <button @click="resetSettings">重置默认</button>
      <router-link to="/login" class="back-link">返回登录</router-link>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useSettingsStore } from '../stores/settings';
const { settings, resetSettings } = useSettingsStore();
</script>

<style scoped>
.settings-container { display: flex; justify-content: center; padding: 2rem; background: #1a1a2e; min-height: 100vh; }
.settings-card { background: #16213e; padding: 2rem; border-radius: 8px; width: 100%; max-width: 500px; }
.settings-card h1 { color: #e94560; margin-bottom: 1.5rem; }
.form-group { margin-bottom: 1rem; }
.form-group label { display: block; color: #e0e0e0; margin-bottom: 0.5rem; }
.form-group input, .form-group select { width: 100%; padding: 0.75rem; border: 1px solid #333; border-radius: 4px; background: #1a1a2e; color: #fff; }
button { padding: 0.75rem 1.5rem; background: #e94560; color: #fff; border: none; border-radius: 4px; cursor: pointer; }
.back-link { display: block; text-align: center; margin-top: 1rem; color: #a0a0a0; }
</style>