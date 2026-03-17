import { describe, it, expect } from 'vitest';
import Fastify from 'fastify';

describe('Health Check', () => {
  it('should return ok status', async () => {
    const fastify = Fastify({ logger: false });

    fastify.get('/api/health', async () => ({ status: 'ok', timestamp: Date.now() }));

    const response = await fastify.inject({
      method: 'GET',
      url: '/api/health',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.status).toBe('ok');
    expect(body.timestamp).toBeDefined();
  });
});