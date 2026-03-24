import { FastifyInstance } from 'fastify';
import bcrypt from 'bcryptjs';
import { authService } from '../services/auth.js';
import { userModel, agentModel, agentPermissionModel } from '../db/index.js';

// Admin middleware - only allow 'admin' user
async function adminOnly(request: any, reply: any) {
  try {
    await request.jwtVerify();
    if (request.user.username !== 'admin') {
      return reply.status(403).send({ error: '无权限' });
    }
  } catch (err) {
    return reply.status(401).send({ error: 'Unauthorized' });
  }
}

export async function adminRoutes(fastify: FastifyInstance) {
  // Get all users
  fastify.get('/api/admin/users', {
    preHandler: adminOnly
  }, async (request, reply) => {
    const users = userModel.findAll();
    return {
      users: users.map(u => ({
        id: u.id,
        username: u.username,
        createdAt: u.created_at,
      })),
    };
  });

  // Create user
  fastify.post('/api/admin/users', {
    preHandler: adminOnly
  }, async (request, reply) => {
    const { username, password } = request.body as { username: string; password: string };

    if (!username || !password) {
      return reply.status(400).send({ error: '用户名和密码必填' });
    }

    if (password.length < 6) {
      return reply.status(400).send({ error: '密码至少6个字符' });
    }

    try {
      const user = await authService.register(username, password);
      return { success: true, userId: user.id };
    } catch (err) {
      return reply.status(400).send({ error: (err as Error).message });
    }
  });

  // Reset password
  fastify.post('/api/admin/reset-password', {
    preHandler: adminOnly
  }, async (request, reply) => {
    const { username } = request.body as { username: string };

    if (!username) {
      return reply.status(400).send({ error: '用户名必填' });
    }

    const user = userModel.findByUsername(username);
    if (!user) {
      return reply.status(400).send({ error: '用户不存在' });
    }

    // Reset password to username
    const SALT_ROUNDS = 10;
    const passwordHash = await bcrypt.hash(username, SALT_ROUNDS);
    userModel.updatePassword(username, passwordHash);

    return { success: true };
  });

  // Disable user (set random password)
  fastify.post('/api/admin/disable-user', {
    preHandler: adminOnly
  }, async (request, reply) => {
    const { username } = request.body as { username: string };

    if (!username) {
      return reply.status(400).send({ error: '用户名必填' });
    }

    const user = userModel.findByUsername(username);
    if (!user) {
      return reply.status(400).send({ error: '用户不存在' });
    }

    // Cannot disable admin
    if (username === 'admin') {
      return reply.status(400).send({ error: '不能禁用管理员账户' });
    }

    // Set random password to disable
    const SALT_ROUNDS = 10;
    const randomPassword = bcrypt.genSaltSync(10).replace(/\//g, '').slice(0, 32);
    const passwordHash = await bcrypt.hash(randomPassword, SALT_ROUNDS);
    userModel.updatePassword(username, passwordHash);

    return { success: true };
  });

  // Delete user
  fastify.post('/api/admin/delete-user', {
    preHandler: adminOnly
  }, async (request, reply) => {
    const { username } = request.body as { username: string };

    if (!username) {
      return reply.status(400).send({ error: '用户名必填' });
    }

    const user = userModel.findByUsername(username);
    if (!user) {
      return reply.status(400).send({ error: '用户不存在' });
    }

    // Cannot delete admin
    if (username === 'admin') {
      return reply.status(400).send({ error: '不能删除管理员账户' });
    }

    userModel.delete(username);

    return { success: true };
  });

  // Get user status
  fastify.get('/api/admin/user-status/:username', {
    preHandler: adminOnly
  }, async (request, reply) => {
    const { username } = request.params as { username: string };

    const user = userModel.findByUsername(username);
    if (!user) {
      return reply.status(400).send({ error: '用户不存在' });
    }

    // Check if password equals username (enabled state)
    const isEnabled = await bcrypt.compare(username, user.password_hash);

    return {
      username: user.username,
      enabled: isEnabled,
      createdAt: user.created_at,
    };
  });

  // Enable user (reset password to username)
  fastify.post('/api/admin/enable-user', {
    preHandler: adminOnly
  }, async (request, reply) => {
    const { username } = request.body as { username: string };

    if (!username) {
      return reply.status(400).send({ error: '用户名必填' });
    }

    const user = userModel.findByUsername(username);
    if (!user) {
      return reply.status(400).send({ error: '用户不存在' });
    }

    // Reset password to username to enable
    const SALT_ROUNDS = 10;
    const passwordHash = await bcrypt.hash(username, SALT_ROUNDS);
    userModel.updatePassword(username, passwordHash);

    return { success: true };
  });

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
}