<template>
  <div v-if="transfers.length > 0" class="transfer-progress">
    <div v-for="transfer in transfers" :key="transfer.id" class="transfer-item">
      <div class="transfer-header">
        <span class="icon">{{ transfer.direction === 'upload' ? '📤' : '📥' }}</span>
        <span class="filename">{{ transfer.fileName }}</span>
        <span class="percent">{{ transfer.percent }}%</span>
      </div>
      <div class="progress-bar">
        <div class="progress-fill" :style="{ width: `${transfer.percent}%` }"></div>
      </div>
      <div v-if="transfer.status === 'error'" class="error">{{ transfer.error }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { TransferProgress } from '@/stores/file';

defineProps<{
  transfers: TransferProgress[];
}>();
</script>

<style scoped>
.transfer-progress {
  position: absolute;
  bottom: 90px;
  left: 10px;
  right: 10px;
  z-index: 100;
  max-height: 150px;
  overflow-y: auto;
}

.transfer-item {
  background: #2a2a3e;
  border-radius: 8px;
  padding: 12px;
  margin-bottom: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
}

.transfer-header {
  display: flex;
  align-items: center;
  margin-bottom: 8px;
}

.icon {
  margin-right: 8px;
}

.filename {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 14px;
}

.percent {
  font-size: 12px;
  color: #888;
  margin-left: 8px;
}

.progress-bar {
  height: 4px;
  background: #444;
  border-radius: 2px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: #4fc3f7;
  transition: width 0.3s ease;
}

.error {
  color: #f44336;
  font-size: 12px;
  margin-top: 8px;
}
</style>