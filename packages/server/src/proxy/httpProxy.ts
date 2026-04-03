// packages/server/src/proxy/httpProxy.ts

import Fastify, { type FastifyRequest } from 'fastify';
import { tunnelManager } from '../ws/tunnel.js';
import type { Message, HttpResponsePayload } from '@remotecli/shared';

const proxyApp = Fastify({ logger: true });

// Configure raw body parser for binary data support (file uploads, POST with binary)
proxyApp.addContentTypeParser('*', { parseAs: 'buffer' }, (_req: FastifyRequest, body: Buffer) => body);

// Store pending requests waiting for Agent response
const pendingRequests = new Map<string, {
  resolve: (response: HttpResponsePayload) => void;
  reject: (error: Error) => void;
  timeout: NodeJS.Timeout;
}>();

// Handle all proxy requests - use wildcard to capture encoded URL
proxyApp.all('/proxy/:sessionId/*', async (request, reply) => {
  const params = request.params as { sessionId: string; '*': string };
  const sessionId = params.sessionId;
  const encodedUrl = params['*'];  // Wildcard captures the rest of the path

  // Decode the target URL
  const targetUrl = decodeURIComponent(encodedUrl);

  // Find corresponding Agent via TunnelManager
  const agentWs = tunnelManager.getAgentWebSocketForSession(sessionId);
  if (!agentWs) {
    reply.code(502).send({ error: 'Agent not connected' });
    return;
  }

  // Generate request ID
  const requestId = crypto.randomUUID();

  // Convert headers to array format for multi-value support
  const headers: Record<string, string | string[]> = {};
  for (const [key, value] of Object.entries(request.headers)) {
    if (value !== undefined) {
      headers[key] = value;
    }
  }

  // Construct request message (sessionId at message level, not payload)
  const httpRequest: Message = {
    type: 'http:request',
    sessionId,
    payload: {
      requestId,
      url: targetUrl,
      method: request.method,
      headers,
      body: request.body ? (request.body as Buffer).toString('base64') : undefined,
    },
    timestamp: Date.now(),
  };

  // Create Promise to wait for response
  const responsePromise = new Promise<HttpResponsePayload>((resolve, reject) => {
    pendingRequests.set(requestId, {
      resolve,
      reject,
      timeout: setTimeout(() => {
        pendingRequests.delete(requestId);
        reject(new Error('Request timeout'));
      }, 30000),  // 30s timeout
    });
  });

  // Send request to Agent
  agentWs.send(JSON.stringify(httpRequest));

  // Wait for response
  try {
    const response = await responsePromise;

    // Convert headers back to flat format for HTTP response
    const flatHeaders: Record<string, string> = {};
    for (const [key, value] of Object.entries(response.headers)) {
      flatHeaders[key] = Array.isArray(value) ? value.join(', ') : value;
    }

    reply.code(response.status);
    reply.headers(flatHeaders);

    // Handle binary response properly
    const bodyBuffer = Buffer.from(response.body, 'base64');
    reply.send(bodyBuffer);
  } catch (err) {
    const error = err as Error;
    reply.code(502).send({ error: error.message });
  }
});

// Handle Agent response
export function handleHttpResponse(message: Message) {
  const payload = message.payload as HttpResponsePayload;
  const pending = pendingRequests.get(payload.requestId);

  if (pending) {
    clearTimeout(pending.timeout);
    pendingRequests.delete(payload.requestId);

    if (payload.error) {
      pending.reject(new Error(payload.error));
    } else {
      pending.resolve(payload);
    }
  }
}

// Start the proxy server
export async function startProxyServer(port: number = 8080) {
  try {
    await proxyApp.listen({ port, host: '0.0.0.0' });
    console.log(`HTTP Proxy server running on port ${port}`);
    return proxyApp;
  } catch (err) {
    proxyApp.log.error(err);
    throw err;
  }
}

export { proxyApp };