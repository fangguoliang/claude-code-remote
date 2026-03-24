# Agent 权限管理系统实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现 Agent 权限管理，支持用户名绑定所有者、跨用户共享、管理员授权界面

**Architecture:** 最小改动方案 - 在现有 agents 表基础上新增 agent_permissions 表存储共享权限，Agent 通过 USERNAME 环境变量绑定所有者

**Tech Stack:** TypeScript, Fastify, SQLite (sql.js), Vue 3, Vitest

---

## File Structure

### 创建文件
- `packages/server/src/__tests__/permissions.test.ts` - 权限管理测试

### 修改文件
- `packages/server/src/db/schema.sql` - 新增 agent_permissions 表
- `packages/server/src/db/index.ts` - 新增 agentPermissionModel, agentModel.updateOwner
- `packages/server/src/routes/admin.ts` - 新增权限管理 API
- `packages/server/src/routes/auth.ts` - 修改 /api/agents 查询逻辑
- `packages/server/src/ws/router.ts` - Agent 注册支持 username
- `packages/agent/src/config.ts` - 使用 USERNAME 替代 USER_ID
- `packages/agent/src/tunnel.ts` - 注册时发送 username
- `packages/web/src/views/SettingsView.vue` - 新增 Agent 授权模块

---

## Task 1: 数据库 Schema 更新

**Files:**
- Modify: `packages/server/src/db/schema.sql`

- [ ] **Step 1: 添加 agent_permissions 表**

在 `schema.sql` 末尾添加：

```sql
-- Agent 权限表（共享权限）
CREATE TABLE IF NOT EXISTS agent_permissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    agent_id TEXT NOT NULL,
    user_id INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (agent_id) REFERENCES agents(agent_id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(agent_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_agent_permissions_agent_id ON agent_permissions(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_permissions_user_id ON agent_permissions(user_id);
```

- [ ] **Step 2: 提交**

```bash
git add packages/server/src/db/schema.sql
git commit -m "feat(db): add agent_permissions table for cross-user sharing"
```

---

## Task 2: 数据模型实现

**Files:**
- Modify: `packages/server/src/db/index.ts`

- [ ] **Step 1: 添加 agentModel.updateOwner 方法**

在 `agentModel` 对象中添加：

```typescript
updateOwner: (agentId: string, name: string | null, userId: number) => {
  runStatement(
    'UPDATE agents SET name = ?, user_id = ?, last_seen = ? WHERE agent_id = ?',
    [name, userId, Date.now(), agentId]
  );
  saveDatabase();
},
```

- [ ] **Step 2: 添加 agentPermissionModel 对象**

在文件末尾 `clearDatabase` 之前添加：

```typescript
// Agent 权限相关操作
export const agentPermissionModel = {
  // 批量授权（笛卡尔积）
  grant: (agentIds: string[], userIds: number[]) => {
    const now = Date.now();
    for (const agentId of agentIds) {
      for (const userId of userIds) {
        try {
          runStatement(
            'INSERT OR IGNORE INTO agent_permissions (agent_id, user_id, created_at) VALUES (?, ?, ?)',
            [agentId, userId, now]
          );
        } catch (e) {
          // 忽略重复插入错误
        }
      }
    }
    saveDatabase();
  },

  // 批量移除权限
  revoke: (agentIds: string[], userIds: number[]) => {
    for (const agentId of agentIds) {
      for (const userId of userIds) {
        runStatement(
          'DELETE FROM agent_permissions WHERE agent_id = ? AND user_id = ?',
          [agentId, userId]
        );
      }
    }
    saveDatabase();
  },

  // 查询 Agent 的共享用户列表
  findByAgentId: (agentId: string) => {
    return queryAll<{ user_id: number; username: string }>(
      `SELECT ap.user_id, u.username FROM agent_permissions ap
       JOIN users u ON ap.user_id = u.id
       WHERE ap.agent_id = ?`,
      [agentId]
    );
  },

  // 查询用户被授权的 Agent 列表
  findByUserId: (userId: number) => {
    return queryAll<{ agent_id: string; name: string | null }>(
      `SELECT a.agent_id, a.name FROM agent_permissions ap
       JOIN agents a ON ap.agent_id = a.agent_id
       WHERE ap.user_id = ?`,
      [userId]
    );
  },

  // 检查用户是否有权限访问 Agent
  hasPermission: (agentId: string, userId: number) => {
    const result = queryOne<{ count: number }>(
      'SELECT COUNT(*) as count FROM agent_permissions WHERE agent_id = ? AND user_id = ?',
      [agentId, userId]
    );
    return (result?.count ?? 0) > 0;
  },
};
```

- [ ] **Step 3: 更新 clearDatabase 函数**

在 `clearDatabase` 中添加清理 agent_permissions：

```typescript
export const clearDatabase = () => {
  db.run('DELETE FROM agent_permissions');
  db.run('DELETE FROM refresh_tokens');
  db.run('DELETE FROM agents');
  db.run('DELETE FROM users');
};
```

- [ ] **Step 4: 提交**

```bash
git add packages/server/src/db/index.ts
git commit -m "feat(db): add agentPermissionModel and agentModel.updateOwner"
```

---

## Task 3: 权限管理 API 实现

**Files:**
- Modify: `packages/server/src/routes/admin.ts`

- [ ] **Step 1: 添加 import**

在文件顶部添加：

```typescript
import { userModel, agentModel, agentPermissionModel } from '../db/index.js';
```

- [ ] **Step 2: 添加 GET /api/admin/agents 接口**

在 `adminRoutes` 函数末尾添加：

```typescript
// Get all agents with owner info
fastify.get('/api/admin/agents', {
  preHandler: adminOnly
}, async (request, reply) => {
  const agents = agentModel.findAll();

  const agentsWithDetails = agents.map(agent => {
    const owner = userModel.findById(agent.user_id);
    const sharedUsers = agentPermissionModel.findByAgentId(agent.agent_id);
    return {
      agentId: agent.agent_id,
      name: agent.name,
      ownerId: agent.user_id,
      ownerName: owner?.username || 'unknown',
      sharedUsers: sharedUsers.map(u => ({ id: u.user_id, username: u.username })),
      lastSeen: agent.last_seen,
      createdAt: agent.created_at,
    };
  });

  return { agents: agentsWithDetails };
});
```

- [ ] **Step 3: 添加 GET /api/admin/agents/:agentId/permissions 接口**

```typescript
// Get agent permission details
fastify.get('/api/admin/agents/:agentId/permissions', {
  preHandler: adminOnly
}, async (request, reply) => {
  const { agentId } = request.params as { agentId: string };

  const agent = agentModel.findByAgentId(agentId);
  if (!agent) {
    return reply.status(404).send({ error: 'Agent not found' });
  }

  const owner = userModel.findById(agent.user_id);
  const sharedUsers = agentPermissionModel.findByAgentId(agentId);

  return {
    agentId: agent.agent_id,
    name: agent.name,
    owner: owner ? { id: owner.id, username: owner.username } : null,
    sharedUsers: sharedUsers.map(u => ({ id: u.user_id, username: u.username })),
  };
});
```

- [ ] **Step 4: 添加 GET /api/admin/users/:userId/permissions 接口**

```typescript
// Get user permission details
fastify.get('/api/admin/users/:userId/permissions', {
  preHandler: adminOnly
}, async (request, reply) => {
  const { userId } = request.params as { userId: string };
  const uid = parseInt(userId, 10);

  const user = userModel.findById(uid);
  if (!user) {
    return reply.status(404).send({ error: 'User not found' });
  }

  const ownedAgents = agentModel.findByUserId(uid);
  const sharedAgents = agentPermissionModel.findByUserId(uid);

  return {
    user: { id: user.id, username: user.username },
    ownedAgents: ownedAgents.map(a => ({ agentId: a.agent_id, name: a.name })),
    sharedAgents: sharedAgents.map(a => ({ agentId: a.agent_id, name: a.name })),
  };
});
```

- [ ] **Step 5: 添加 POST /api/admin/agent-permissions 接口**

```typescript
// Batch grant permissions
fastify.post('/api/admin/agent-permissions', {
  preHandler: adminOnly
}, async (request, reply) => {
  const { userIds, agentIds } = request.body as {
    userIds: number[];
    agentIds: string[];
  };

  if (!userIds?.length || !agentIds?.length) {
    return reply.status(400).send({ error: 'userIds and agentIds are required' });
  }

  agentPermissionModel.grant(agentIds, userIds);
  return { success: true };
});
```

- [ ] **Step 6: 添加 DELETE /api/admin/agent-permissions 接口**

```typescript
// Batch revoke permissions
fastify.delete('/api/admin/agent-permissions', {
  preHandler: adminOnly
}, async (request, reply) => {
  const { userIds, agentIds } = request.body as {
    userIds: number[];
    agentIds: string[];
  };

  if (!userIds?.length || !agentIds?.length) {
    return reply.status(400).send({ error: 'userIds and agentIds are required' });
  }

  agentPermissionModel.revoke(agentIds, userIds);
  return { success: true };
});
```

- [ ] **Step 7: 添加 POST /api/admin/agent-permissions/transfer-owner 接口**

```typescript
// Transfer agent owner
fastify.post('/api/admin/agent-permissions/transfer-owner', {
  preHandler: adminOnly
}, async (request, reply) => {
  const { agentId, newOwnerId } = request.body as {
    agentId: string;
    newOwnerId: number;
  };

  if (!agentId || !newOwnerId) {
    return reply.status(400).send({ error: 'agentId and newOwnerId are required' });
  }

  const agent = agentModel.findByAgentId(agentId);
  if (!agent) {
    return reply.status(404).send({ error: 'Agent not found' });
  }

  const newUser = userModel.findById(newOwnerId);
  if (!newUser) {
    return reply.status(404).send({ error: 'User not found' });
  }

  agentModel.updateOwner(agentId, agent.name, newOwnerId);
  return { success: true };
});
```

- [ ] **Step 8: 提交**

```bash
git add packages/server/src/routes/admin.ts
git commit -m "feat(api): add agent permission management endpoints"
```

---

## Task 4: 修改用户 Agent 查询逻辑

**Files:**
- Modify: `packages/server/src/routes/auth.ts`

- [ ] **Step 1: 修改 /api/agents 接口**

将现有的 `/api/agents` 处理逻辑替换为：

```typescript
// 获取用户的 Agent 列表
fastify.get('/api/agents', {
  preHandler: async (request, reply) => {
    try {
      await request.jwtVerify();
    } catch (err) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }
  }
}, async (request, reply) => {
  const payload = request.user as { userId: number; username: string };

  // 获取用户拥有的 Agent
  const ownedAgents = agentModel.findByUserId(payload.userId);

  // 获取用户被授权的 Agent
  const sharedAgents = agentPermissionModel.findByUserId(payload.userId);

  // 合并去重
  const agentMap = new Map<string, { agentId: string; name: string | null; online: boolean; lastSeen: number | null; isOwner: boolean }>();

  for (const agent of ownedAgents) {
    agentMap.set(agent.agent_id, {
      agentId: agent.agent_id,
      name: agent.name,
      online: tunnelManager.isAgentOnline(agent.agent_id),
      lastSeen: agent.last_seen,
      isOwner: true,
    });
  }

  for (const agent of sharedAgents) {
    if (!agentMap.has(agent.agent_id)) {
      agentMap.set(agent.agent_id, {
        agentId: agent.agent_id,
        name: agent.name,
        online: tunnelManager.isAgentOnline(agent.agent_id),
        lastSeen: null,
        isOwner: false,
      });
    }
  }

  return { agents: Array.from(agentMap.values()) };
});
```

- [ ] **Step 2: 添加 import**

在文件顶部添加：

```typescript
import { userModel, refreshTokenModel, agentModel, agentPermissionModel } from '../db/index.js';
```

- [ ] **Step 3: 提交**

```bash
git add packages/server/src/routes/auth.ts
git commit -m "feat(api): include shared agents in user agent list"
```

---

## Task 5: Agent 注册支持 Username

**Files:**
- Modify: `packages/server/src/ws/router.ts`

- [ ] **Step 1: 修改 handleAgentRegister 函数**

替换现有的 `handleAgentRegister` 函数：

```typescript
function handleAgentRegister(ws: WebSocket, payload: any) {
  const { agentId, username, name } = payload;

  // 验证必填字段
  if (!agentId) {
    ws.send(JSON.stringify({
      type: 'register:result',
      payload: { success: false, error: 'Missing agentId' },
      timestamp: Date.now(),
    }));
    return;
  }

  // 根据 username 查找用户，默认 admin
  const user = userModel.findByUsername(username || 'admin');
  if (!user) {
    ws.send(JSON.stringify({
      type: 'register:result',
      payload: { success: false, error: 'User not found' },
      timestamp: Date.now(),
    }));
    return;
  }

  // 确保 Agent 在数据库中存在
  let agent = agentModel.findByAgentId(agentId);
  if (!agent) {
    agent = agentModel.create(agentId, name || null, user.id);
  } else {
    // 更新 name、last_seen 和所有者（支持重连时转移归属）
    agentModel.updateOwner(agentId, name || null, user.id);
  }

  // 注册 Agent 到 TunnelManager
  tunnelManager.registerAgent(ws, agentId, user.id);

  ws.send(JSON.stringify({
    type: 'register:result',
    payload: { success: true },
    timestamp: Date.now(),
  }));
}
```

- [ ] **Step 2: 添加 import**

在文件顶部添加：

```typescript
import { agentModel, userModel } from '../db/index.js';
```

- [ ] **Step 3: 添加会话权限验证**

在 `handleSessionCreate` 函数中，`tunnelManager.createSession` 调用之前添加权限验证：

```typescript
function handleSessionCreate(ws: WebSocket, payload: any) {
  const sessionId = generateUUID();
  const { cols, rows, agentId } = payload;

  // 如果消息中指定了 agentId，先绑定
  if (agentId) {
    tunnelManager.bindBrowserToAgent(ws, agentId);
  }

  // 获取浏览器信息用于权限验证
  const browser = tunnelManager.getBrowser(ws);
  if (!browser?.agentId) {
    ws.send(JSON.stringify({
      type: 'session:created',
      payload: { success: false, error: 'No agent selected' },
      timestamp: Date.now(),
    }));
    return;
  }

  // 验证用户是否有权限访问该 Agent
  const agent = agentModel.findByAgentId(browser.agentId);
  if (!agent) {
    ws.send(JSON.stringify({
      type: 'session:created',
      payload: { success: false, error: 'Agent not found' },
      timestamp: Date.now(),
    }));
    return;
  }

  // 检查权限：所有者或被授权用户
  const isOwner = agent.user_id === browser.userId;
  const hasSharedAccess = agentPermissionModel.hasPermission(browser.agentId, browser.userId);

  if (!isOwner && !hasSharedAccess) {
    ws.send(JSON.stringify({
      type: 'session:created',
      payload: { success: false, error: 'Permission denied' },
      timestamp: Date.now(),
    }));
    return;
  }

  const success = tunnelManager.createSession(ws, sessionId);

  // ... 后续代码保持不变
}
```

- [ ] **Step 4: 添加 import**

```typescript
import { agentModel, userModel, agentPermissionModel } from '../db/index.js';
```

- [ ] **Step 5: 提交**

```bash
git add packages/server/src/ws/router.ts
git commit -m "feat(ws): support username-based agent registration and permission check"
```

---

## Task 6: Agent 配置修改

**Files:**
- Modify: `packages/agent/src/config.ts`

- [ ] **Step 1: 修改配置**

将现有配置修改为：

```typescript
import 'dotenv/config';

export const config = {
  serverUrl: process.env.SERVER_URL || 'ws://localhost:3000/ws/agent',
  agentId: process.env.AGENT_ID || crypto.randomUUID(),
  agentSecret: process.env.AGENT_SECRET || 'dev-secret',
  username: process.env.USERNAME || 'admin',  // 使用用户名，默认 admin
  reconnectInterval: 5000,
  heartbeatInterval: 30000,
};
```

- [ ] **Step 2: 提交**

```bash
git add packages/agent/src/config.ts
git commit -m "feat(agent): use USERNAME env var for owner binding"
```

---

## Task 7: Agent 注册消息修改

**Files:**
- Modify: `packages/agent/src/tunnel.ts`

- [ ] **Step 1: 修改 register 方法**

将现有的 `register` 方法修改为：

```typescript
private register() {
  this.send({
    type: 'register',
    payload: {
      agentId: config.agentId,
      username: config.username,  // 发送用户名而非 userId
      name: getAgentName(),
    },
    timestamp: Date.now(),
  });
}
```

- [ ] **Step 2: 提交**

```bash
git add packages/agent/src/tunnel.ts
git commit -m "feat(agent): send username in registration payload"
```

---

## Task 8: 前端 Agent 授权管理界面

**Files:**
- Modify: `packages/web/src/views/SettingsView.vue`

- [ ] **Step 1: 添加 Agent 授权模块状态变量**

在 script setup 中添加：

```typescript
// Agent authorization state
const agents = ref<{ agentId: string; name: string | null; ownerId: number; ownerName: string; sharedUsers: { id: number; username: string }[] }[]>([]);
const selectedAgent = ref('');
const selectedUserForView = ref('');
const permissionDetail = ref('');
const multiSelectAgents = ref<string[]>([]);
const multiSelectUsers = ref<number[]>([]);
const transferAgentId = ref('');
const transferUserId = ref<number | null>(null);
```

- [ ] **Step 2: 添加获取 Agent 列表函数**

```typescript
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
```

- [ ] **Step 3: 添加查看 Agent 权限函数**

```typescript
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
```

- [ ] **Step 4: 添加查看用户权限函数**

```typescript
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
```

- [ ] **Step 5: 添加批量授权函数**

```typescript
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
```

- [ ] **Step 6: 添加批量移除函数**

```typescript
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
```

- [ ] **Step 7: 添加转移所有者函数**

```typescript
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
```

- [ ] **Step 8: 修改 onMounted 加载 agents**

```typescript
onMounted(() => {
  fetchUsers();
  fetchAgents();
});
```

- [ ] **Step 9: 添加 Agent 授权模块模板**

在 `</div>` 关闭 admin-section 之前，用户管理部分之后添加：

```vue
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
```

- [ ] **Step 10: 添加样式**

在 style 部分添加：

```css
.permission-detail { width: 100%; padding: 0.75rem; border: 1px solid #333; border-radius: 4px; background: #1a1a2e; color: #fff; font-family: monospace; resize: vertical; }
.checkbox-group { display: flex; flex-wrap: wrap; gap: 0.5rem; }
.checkbox-label { display: flex; align-items: center; gap: 0.25rem; color: #e0e0e0; font-size: 0.9rem; cursor: pointer; }
.checkbox-label input { width: auto; }
```

- [ ] **Step 11: 提交**

```bash
git add packages/web/src/views/SettingsView.vue
git commit -m "feat(web): add agent authorization management UI in settings"
```

---

## Task 9: 集成测试

**Files:**
- Create: `packages/server/src/__tests__/permissions.test.ts`

- [ ] **Step 1: 编写测试文件**

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import Fastify from 'fastify';
import jwt from '@fastify/jwt';
import cors from '@fastify/cors';
import { authRoutes } from '../routes/auth.js';
import { adminRoutes } from '../routes/admin.js';
import { userModel, agentModel, agentPermissionModel, clearDatabase } from '../db/index.js';

async function buildServer() {
  const fastify = Fastify({ logger: false });
  await fastify.register(cors, { origin: '*' });
  await fastify.register(jwt, { secret: 'test-secret-key-for-testing' });
  await fastify.register(authRoutes);
  await fastify.register(adminRoutes);
  return fastify;
}

describe('Agent Permissions', () => {
  beforeEach(() => {
    clearDatabase();
  });

  describe('POST /api/admin/agent-permissions', () => {
    it('should grant permissions to multiple users for multiple agents', async () => {
      const fastify = await buildServer();

      // Create admin and users
      const admin = userModel.create('admin', 'hash');
      const user1 = userModel.create('user1', 'hash');
      const user2 = userModel.create('user2', 'hash');
      const agent1 = agentModel.create('agent-1', 'Agent 1', admin.id);
      const agent2 = agentModel.create('agent-2', 'Agent 2', admin.id);

      // Login as admin
      const token = fastify.jwt.sign({ userId: admin.id, username: 'admin' });

      const response = await fastify.inject({
        method: 'POST',
        url: '/api/admin/agent-permissions',
        headers: { Authorization: `Bearer ${token}` },
        payload: {
          userIds: [user1.id, user2.id],
          agentIds: ['agent-1', 'agent-2'],
        },
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body).success).toBe(true);

      // Verify permissions were created
      const shared1 = agentPermissionModel.findByAgentId('agent-1');
      expect(shared1.length).toBe(2);
    });
  });

  describe('DELETE /api/admin/agent-permissions', () => {
    it('should revoke permissions', async () => {
      const fastify = await buildServer();

      const admin = userModel.create('admin', 'hash');
      const user1 = userModel.create('user1', 'hash');
      agentModel.create('agent-1', 'Agent 1', admin.id);

      // Grant then revoke
      agentPermissionModel.grant(['agent-1'], [user1.id]);
      expect(agentPermissionModel.hasPermission('agent-1', user1.id)).toBe(true);

      const token = fastify.jwt.sign({ userId: admin.id, username: 'admin' });
      await fastify.inject({
        method: 'DELETE',
        url: '/api/admin/agent-permissions',
        headers: { Authorization: `Bearer ${token}` },
        payload: { userIds: [user1.id], agentIds: ['agent-1'] },
      });

      expect(agentPermissionModel.hasPermission('agent-1', user1.id)).toBe(false);
    });
  });

  describe('POST /api/admin/agent-permissions/transfer-owner', () => {
    it('should transfer agent ownership', async () => {
      const fastify = await buildServer();

      const admin = userModel.create('admin', 'hash');
      const user1 = userModel.create('user1', 'hash');
      agentModel.create('agent-1', 'Agent 1', admin.id);

      const token = fastify.jwt.sign({ userId: admin.id, username: 'admin' });
      const response = await fastify.inject({
        method: 'POST',
        url: '/api/admin/agent-permissions/transfer-owner',
        headers: { Authorization: `Bearer ${token}` },
        payload: { agentId: 'agent-1', newOwnerId: user1.id },
      });

      expect(response.statusCode).toBe(200);

      const agent = agentModel.findByAgentId('agent-1');
      expect(agent?.user_id).toBe(user1.id);
    });
  });

  describe('hasPermission', () => {
    it('should return false for owner check (owner is not in permissions table)', async () => {
      const admin = userModel.create('admin', 'hash');
      agentModel.create('agent-1', 'Agent 1', admin.id);

      // Owner should NOT be in permissions table
      expect(agentPermissionModel.hasPermission('agent-1', admin.id)).toBe(false);
    });

    it('should return true for shared user', async () => {
      const admin = userModel.create('admin', 'hash');
      const user1 = userModel.create('user1', 'hash');
      agentModel.create('agent-1', 'Agent 1', admin.id);

      agentPermissionModel.grant(['agent-1'], [user1.id]);
      expect(agentPermissionModel.hasPermission('agent-1', user1.id)).toBe(true);
    });
  });
});
```

- [ ] **Step 2: 运行测试**

```bash
cd packages/server && pnpm test
```

Expected: All tests pass

- [ ] **Step 3: 提交**

```bash
git add packages/server/src/__tests__/permissions.test.ts
git commit -m "test: add agent permission management tests"
```

---

## Task 10: 更新 Agent .env.example

**Files:**
- Modify: `packages/agent/.env.example`

- [ ] **Step 1: 更新配置示例**

```env
SERVER_URL=ws://localhost:3000/ws/agent
AGENT_ID=your-agent-id
USERNAME=admin
```

- [ ] **Step 2: 提交**

```bash
git add packages/agent/.env.example
git commit -m "docs: update agent env example with USERNAME"
```

---

## Final: 构建验证

- [ ] **Step 1: 运行全部测试**

```bash
cd packages/server && pnpm test
```

- [ ] **Step 2: 类型检查**

```bash
cd packages/web && pnpm typecheck
```

- [ ] **Step 3: 构建验证**

```bash
pnpm build
```

- [ ] **Step 4: 最终提交**

```bash
git add -A
git commit -m "feat: complete agent permission management system

- Add agent_permissions table for cross-user sharing
- Support USERNAME-based agent ownership binding
- Add admin APIs for permission management
- Add permission validation on session creation
- Add agent authorization UI in settings page"
```