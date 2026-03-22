import { FastifyInstance } from 'fastify';
import bcrypt from 'bcryptjs';
import { authService } from '../services/auth.js';
import { userModel } from '../db/index.js';

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
}