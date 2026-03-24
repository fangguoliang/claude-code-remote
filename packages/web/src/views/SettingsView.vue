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

      <!-- Admin User Management Section -->
      <div v-if="isAdmin" class="admin-section">
        <h2>用户管理</h2>

        <!-- User Selection -->
        <div class="form-group">
          <label>选择用户</label>
          <select v-model="selectedUser">
            <option value="">选择用户</option>
            <option v-for="user in users" :key="user.id" :value="user.username">
              {{ user.username }}
            </option>
          </select>
        </div>

        <!-- User Action Buttons -->
        <div class="button-group">
          <button @click="handleResetPassword" :disabled="!selectedUser || loading" class="btn-sm">
            重置密码
          </button>
          <button @click="handleDisableUser" :disabled="!selectedUser || loading" class="btn-sm btn-warning">
            禁用
          </button>
          <button @click="handleDeleteUser" :disabled="!selectedUser || loading" class="btn-sm btn-danger">
            删除
          </button>
        </div>
        <div class="button-group">
          <button @click="handleViewStatus" :disabled="!selectedUser || loading" class="btn-sm btn-info">
            查看状态
          </button>
          <button @click="handleEnableUser" :disabled="!selectedUser || loading" class="btn-sm btn-success">
            启用
          </button>
        </div>
        <p v-if="actionMessage" :class="actionError ? 'error' : 'success'">{{ actionMessage }}</p>

        <!-- Create User -->
        <h3 style="margin-top: 1.5rem;">创建用户</h3>
        <div class="form-group">
          <label>用户名</label>
          <input v-model="newUsername" type="text" />
        </div>
        <div class="form-group">
          <label>密码</label>
          <input v-model="newPassword" type="password" />
        </div>
        <button @click="handleCreateUser" :disabled="!newUsername || !newPassword || loading">
          {{ loading ? '处理中...' : '创建用户' }}
        </button>
        <p v-if="createMessage" :class="createError ? 'error' : 'success'">{{ createMessage }}</p>

        <!-- Agent Authorization Section -->
        <h2 style="margin-top: 2rem;">Agent 授权管理</h2>

        <!-- View Permissions -->
        <div class="form-group">
          <label>选择 Agent</label>
          <select v-model="selectedAgent">
            <option value="">选择 Agent</option>
            <option v-for="agent in agents" :key="agent.agentId" :value="agent.agentId">
              {{ agent.name || agent.agentId }}
            </option>
          </select>
        </div>
        <div class="form-group">
          <label>选择用户</label>
          <select v-model="selectedUserForView">
            <option value="">选择用户</option>
            <option v-for="user in users" :key="user.id" :value="user.username">
              {{ user.username }}
            </option>
          </select>
        </div>
        <div class="button-group">
          <button @click="handleViewAgentPermissions" :disabled="!selectedAgent" class="btn-sm btn-info">查看 Agent 权限</button>
          <button @click="handleViewUserPermissions" :disabled="!selectedUserForView" class="btn-sm btn-info">查看用户权限</button>
        </div>

        <!-- Permission Detail -->
        <div class="form-group" v-if="permissionDetail">
          <label>权限详情</label>
          <textarea :value="permissionDetail" readonly rows="4" class="permission-detail"></textarea>
        </div>

        <!-- Batch Operations -->
        <h3 style="margin-top: 1.5rem;">批量操作</h3>
        <div class="form-group">
          <label>用户多选</label>
          <div class="checkbox-group">
            <label v-for="user in users" :key="user.id" class="checkbox-label">
              <input type="checkbox" :value="user.id" v-model="multiSelectUsers" />
              {{ user.username }}
            </label>
          </div>
        </div>
        <div class="form-group">
          <label>Agent 多选</label>
          <div class="checkbox-group">
            <label v-for="agent in agents" :key="agent.agentId" class="checkbox-label">
              <input type="checkbox" :value="agent.agentId" v-model="multiSelectAgents" />
              {{ agent.name || agent.agentId }}
            </label>
          </div>
        </div>
        <div class="button-group">
          <button @click="handleGrantPermissions" :disabled="!multiSelectUsers.length || !multiSelectAgents.length" class="btn-sm btn-success">授权选中</button>
          <button @click="handleRevokePermissions" :disabled="!multiSelectUsers.length || !multiSelectAgents.length" class="btn-sm btn-danger">移除选中</button>
        </div>

        <!-- Transfer Owner -->
        <h3 style="margin-top: 1.5rem;">转移所有者</h3>
        <div class="form-group">
          <label>选择 Agent</label>
          <select v-model="transferAgentId">
            <option value="">选择 Agent</option>
            <option v-for="agent in agents" :key="agent.agentId" :value="agent.agentId">
              {{ agent.name || agent.agentId }} ({{ agent.ownerName }})
            </option>
          </select>
        </div>
        <div class="form-group">
          <label>新所有者</label>
          <select v-model="transferUserId">
            <option :value="null">选择用户</option>
            <option v-for="user in users" :key="user.id" :value="user.id">
              {{ user.username }}
            </option>
          </select>
        </div>
        <button @click="handleTransferOwner" :disabled="!transferAgentId || !transferUserId" class="btn-sm btn-warning">转移所有者</button>
      </div>

      <router-link v-if="isAuthenticated" to="/terminal" class="back-link">返回终端</router-link>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useSettingsStore } from '../stores/settings';
import { useAuthStore } from '../stores/auth';

const { settings, resetSettings } = useSettingsStore();
const authStore = useAuthStore();

const isAdmin = computed(() => authStore.username === 'admin');
const isAuthenticated = computed(() => authStore.isAuthenticated);

// User management state
const users = ref<{ id: number; username: string }[]>([]);
const selectedUser = ref('');
const loading = ref(false);
const actionMessage = ref('');
const actionError = ref(false);
const newUsername = ref('');
const newPassword = ref('');
const createMessage = ref('');
const createError = ref(false);

// Agent authorization state
const agents = ref<{ agentId: string; name: string | null; ownerId: number; ownerName: string; sharedUsers: { id: number; username: string }[] }[]>([]);
const selectedAgent = ref('');
const selectedUserForView = ref('');
const permissionDetail = ref('');
const multiSelectAgents = ref<string[]>([]);
const multiSelectUsers = ref<number[]>([]);
const transferAgentId = ref('');
const transferUserId = ref<number | null>(null);

async function fetchUsers() {
  if (!isAdmin.value || !authStore.accessToken) return;

  try {
    const response = await fetch(`${settings.apiUrl}/api/admin/users`, {
      headers: { Authorization: `Bearer ${authStore.accessToken}` },
    });
    const data = await response.json();
    if (data.users) {
      users.value = data.users;
    }
  } catch (e) {
    console.error('Failed to fetch users:', e);
  }
}

async function fetchAgents() {
  if (!isAdmin.value || !authStore.accessToken) return;

  try {
    const response = await fetch(`${settings.apiUrl}/api/admin/agents`, {
      headers: { Authorization: `Bearer ${authStore.accessToken}` },
    });
    const data = await response.json();
    if (data.agents) {
      agents.value = data.agents;
    }
  } catch (e) {
    console.error('Failed to fetch agents:', e);
  }
}

async function handleViewAgentPermissions() {
  if (!selectedAgent.value || !authStore.accessToken) return;

  try {
    const response = await fetch(`${settings.apiUrl}/api/admin/agents/${selectedAgent.value}/permissions`, {
      headers: { Authorization: `Bearer ${authStore.accessToken}` },
    });
    const data = await response.json();
    if (data.agentId) {
      const sharedNames = data.sharedUsers.map((u: { username: string }) => u.username).join(', ') || '无';
      permissionDetail.value = `Agent: ${data.name || data.agentId}\n所有者: ${data.owner?.username || '未知'}\n可使用用户: ${sharedNames}`;
    }
  } catch (e) {
    permissionDetail.value = '查询失败';
  }
}

async function handleViewUserPermissions() {
  if (!selectedUserForView.value || !authStore.accessToken) return;

  const user = users.value.find(u => u.username === selectedUserForView.value);
  if (!user) return;

  try {
    const response = await fetch(`${settings.apiUrl}/api/admin/users/${user.id}/permissions`, {
      headers: { Authorization: `Bearer ${authStore.accessToken}` },
    });
    const data = await response.json();
    if (data.user) {
      const ownedNames = data.ownedAgents.map((a: { name: string | null; agentId: string }) => a.name || a.agentId).join(', ') || '无';
      const sharedNames = data.sharedAgents.map((a: { name: string | null; agentId: string }) => a.name || a.agentId).join(', ') || '无';
      permissionDetail.value = `用户: ${data.user.username}\n拥有的 Agent: ${ownedNames}\n可使用的 Agent: ${sharedNames}`;
    }
  } catch (e) {
    permissionDetail.value = '查询失败';
  }
}

async function handleGrantPermissions() {
  if (!multiSelectAgents.value.length || !multiSelectUsers.value.length || !authStore.accessToken) return;

  try {
    const response = await fetch(`${settings.apiUrl}/api/admin/agent-permissions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authStore.accessToken}`,
      },
      body: JSON.stringify({
        agentIds: multiSelectAgents.value,
        userIds: multiSelectUsers.value,
      }),
    });
    const data = await response.json();
    if (data.success) {
      permissionDetail.value = '授权成功';
      await fetchAgents();
    }
  } catch (e) {
    permissionDetail.value = '授权失败';
  }
}

async function handleRevokePermissions() {
  if (!multiSelectAgents.value.length || !multiSelectUsers.value.length || !authStore.accessToken) return;

  try {
    const response = await fetch(`${settings.apiUrl}/api/admin/agent-permissions`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authStore.accessToken}`,
      },
      body: JSON.stringify({
        agentIds: multiSelectAgents.value,
        userIds: multiSelectUsers.value,
      }),
    });
    const data = await response.json();
    if (data.success) {
      permissionDetail.value = '移除成功';
      await fetchAgents();
    }
  } catch (e) {
    permissionDetail.value = '移除失败';
  }
}

async function handleTransferOwner() {
  if (!transferAgentId.value || !transferUserId.value || !authStore.accessToken) return;

  try {
    const response = await fetch(`${settings.apiUrl}/api/admin/agent-permissions/transfer-owner`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authStore.accessToken}`,
      },
      body: JSON.stringify({
        agentId: transferAgentId.value,
        newOwnerId: transferUserId.value,
      }),
    });
    const data = await response.json();
    if (data.success) {
      permissionDetail.value = '转移成功';
      await fetchAgents();
    }
  } catch (e) {
    permissionDetail.value = '转移失败';
  }
}

async function handleResetPassword() {
  if (!selectedUser.value || !authStore.accessToken) return;

  loading.value = true;
  actionMessage.value = '';
  actionError.value = false;

  try {
    const response = await fetch(`${settings.apiUrl}/api/admin/reset-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authStore.accessToken}`,
      },
      body: JSON.stringify({ username: selectedUser.value }),
    });
    const data = await response.json();
    if (data.success) {
      actionMessage.value = `密码已重置为用户名: ${selectedUser.value}`;
    } else {
      actionError.value = true;
      actionMessage.value = data.error || '重置失败';
    }
  } catch (e) {
    actionError.value = true;
    actionMessage.value = '网络错误';
  } finally {
    loading.value = false;
  }
}

async function handleDisableUser() {
  if (!selectedUser.value || !authStore.accessToken) return;

  loading.value = true;
  actionMessage.value = '';
  actionError.value = false;

  try {
    const response = await fetch(`${settings.apiUrl}/api/admin/disable-user`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authStore.accessToken}`,
      },
      body: JSON.stringify({ username: selectedUser.value }),
    });
    const data = await response.json();
    if (data.success) {
      actionMessage.value = `用户 ${selectedUser.value} 已禁用`;
    } else {
      actionError.value = true;
      actionMessage.value = data.error || '禁用失败';
    }
  } catch (e) {
    actionError.value = true;
    actionMessage.value = '网络错误';
  } finally {
    loading.value = false;
  }
}

async function handleDeleteUser() {
  if (!selectedUser.value || !authStore.accessToken) return;

  if (!confirm(`确定要删除用户 "${selectedUser.value}" 吗？此操作不可恢复。`)) {
    return;
  }

  loading.value = true;
  actionMessage.value = '';
  actionError.value = false;

  try {
    const response = await fetch(`${settings.apiUrl}/api/admin/delete-user`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authStore.accessToken}`,
      },
      body: JSON.stringify({ username: selectedUser.value }),
    });
    const data = await response.json();
    if (data.success) {
      actionMessage.value = `用户 ${selectedUser.value} 已删除`;
      selectedUser.value = '';
      await fetchUsers(); // Refresh user list
    } else {
      actionError.value = true;
      actionMessage.value = data.error || '删除失败';
    }
  } catch (e) {
    actionError.value = true;
    actionMessage.value = '网络错误';
  } finally {
    loading.value = false;
  }
}

async function handleViewStatus() {
  if (!selectedUser.value || !authStore.accessToken) return;

  loading.value = true;
  actionMessage.value = '';
  actionError.value = false;

  try {
    const response = await fetch(`${settings.apiUrl}/api/admin/user-status/${selectedUser.value}`, {
      headers: { Authorization: `Bearer ${authStore.accessToken}` },
    });
    const data = await response.json();
    if (data.username) {
      const status = data.enabled ? '已启用' : '已禁用';
      const date = new Date(data.createdAt).toLocaleString('zh-CN');
      actionMessage.value = `用户: ${data.username}\n状态: ${status}\n创建时间: ${date}`;
    } else {
      actionError.value = true;
      actionMessage.value = data.error || '查询失败';
    }
  } catch (e) {
    actionError.value = true;
    actionMessage.value = '网络错误';
  } finally {
    loading.value = false;
  }
}

async function handleEnableUser() {
  if (!selectedUser.value || !authStore.accessToken) return;

  loading.value = true;
  actionMessage.value = '';
  actionError.value = false;

  try {
    const response = await fetch(`${settings.apiUrl}/api/admin/enable-user`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authStore.accessToken}`,
      },
      body: JSON.stringify({ username: selectedUser.value }),
    });
    const data = await response.json();
    if (data.success) {
      actionMessage.value = `用户 ${selectedUser.value} 已启用，密码为用户名`;
    } else {
      actionError.value = true;
      actionMessage.value = data.error || '启用失败';
    }
  } catch (e) {
    actionError.value = true;
    actionMessage.value = '网络错误';
  } finally {
    loading.value = false;
  }
}

async function handleCreateUser() {
  if (!newUsername.value || !newPassword.value || !authStore.accessToken) return;

  loading.value = true;
  createMessage.value = '';
  createError.value = false;

  try {
    const response = await fetch(`${settings.apiUrl}/api/admin/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authStore.accessToken}`,
      },
      body: JSON.stringify({ username: newUsername.value, password: newPassword.value }),
    });
    const data = await response.json();
    if (data.success) {
      createMessage.value = '用户创建成功';
      newUsername.value = '';
      newPassword.value = '';
      await fetchUsers(); // Refresh user list
    } else {
      createError.value = true;
      createMessage.value = data.error || '创建失败';
    }
  } catch (e) {
    createError.value = true;
    createMessage.value = '网络错误';
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  fetchUsers();
  fetchAgents();
});
</script>

<style scoped>
.settings-container { display: flex; justify-content: center; padding: 2rem; background: #1a1a2e; min-height: 100vh; }
.settings-card { background: #16213e; padding: 2rem; border-radius: 8px; width: 100%; max-width: 500px; }
.settings-card h1 { color: #e94560; margin-bottom: 1.5rem; }
.form-group { margin-bottom: 1rem; }
.form-group label { display: block; color: #e0e0e0; margin-bottom: 0.5rem; }
.form-group input, .form-group select { width: 100%; padding: 0.75rem; border: 1px solid #333; border-radius: 4px; background: #1a1a2e; color: #fff; }
button { padding: 0.75rem 1.5rem; background: #e94560; color: #fff; border: none; border-radius: 4px; cursor: pointer; }
button:disabled { opacity: 0.6; }
.back-link { display: block; text-align: center; margin-top: 1rem; color: #a0a0a0; }
.admin-section { margin-top: 2rem; padding-top: 1.5rem; border-top: 1px solid #333; }
.admin-section h2 { color: #e94560; margin-bottom: 1rem; font-size: 1.2rem; }
.admin-section h3 { color: #e0e0e0; margin-bottom: 0.5rem; font-size: 1rem; }
.button-group { display: flex; gap: 0.5rem; margin-bottom: 0.5rem; }
.button-group button { flex: 1; }
.btn-sm { padding: 0.4rem 0.8rem; font-size: 0.85rem; }
.btn-warning { background: #ff9800; }
.btn-danger { background: #f44336; }
.btn-info { background: #2196f3; }
.btn-success { background: #4caf50; }
.error { color: #e94560; margin-top: 0.5rem; font-size: 0.9rem; white-space: pre-line; }
.success { color: #4caf50; margin-top: 0.5rem; font-size: 0.9rem; white-space: pre-line; }
.permission-detail { width: 100%; padding: 0.75rem; border: 1px solid #333; border-radius: 4px; background: #1a1a2e; color: #fff; font-family: monospace; resize: vertical; }
.checkbox-group { display: flex; flex-wrap: wrap; gap: 0.5rem; }
.checkbox-label { display: flex; align-items: center; gap: 0.25rem; color: #e0e0e0; font-size: 0.9rem; cursor: pointer; }
.checkbox-label input { width: auto; }
</style>