// packages/agent/src/httpHandler.ts

import http from 'http';
import { WebSocket } from 'ws';
import type { Message, HttpRequestPayload } from '@remotecli/shared';

export async function handleHttpRequest(ws: WebSocket, message: Message) {
  const payload = message.payload as HttpRequestPayload;
  const sessionId = message.sessionId;
  const { requestId, url, method, headers, body } = payload;

  // Parse target URL (usually localhost)
  let targetUrl: URL;
  try {
    targetUrl = new URL(url);
  } catch {
    // Invalid URL
    ws.send(JSON.stringify({
      type: 'http:response',
      sessionId,
      payload: {
        requestId,
        status: 400,
        headers: {},
        body: '',
        error: 'Invalid URL',
      },
      timestamp: Date.now(),
    }));
    return;
  }

  // Convert headers to flat format for http.request
  const flatHeaders: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers || {})) {
    flatHeaders[key] = Array.isArray(value) ? value[0] : value;
  }

  try {
    // Execute HTTP request
    const response = await executeHttpRequest({
      hostname: targetUrl.hostname,
      port: parseInt(targetUrl.port) || (targetUrl.protocol === 'https:' ? 443 : 80),
      path: targetUrl.pathname + targetUrl.search,
      method,
      headers: flatHeaders,
      body: body ? Buffer.from(body, 'base64') : undefined,
    });

    // Convert response headers to array format for multi-value support
    const responseHeaders: Record<string, string | string[]> = {};
    for (const [key, value] of Object.entries(response.headers)) {
      responseHeaders[key] = value;
    }

    // Construct response message
    ws.send(JSON.stringify({
      type: 'http:response',
      sessionId,
      payload: {
        requestId,
        status: response.status,
        headers: responseHeaders,
        body: response.body.toString('base64'),
      },
      timestamp: Date.now(),
    }));
  } catch (err) {
    const error = err as Error;
    // Error response
    ws.send(JSON.stringify({
      type: 'http:response',
      sessionId,
      payload: {
        requestId,
        status: 502,
        headers: {},
        body: '',
        error: error.message,
      },
      timestamp: Date.now(),
    }));
  }
}

// Execute HTTP request using Node.js http module
async function executeHttpRequest(options: {
  hostname: string;
  port: number;
  path: string;
  method: string;
  headers: Record<string, string>;
  body?: Buffer;
}): Promise<{ status: number; headers: Record<string, string | string[]>; body: Buffer }> {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      const chunks: Buffer[] = [];

      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        resolve({
          status: res.statusCode || 200,
          headers: res.headers as Record<string, string | string[]>,
          body: Buffer.concat(chunks),
        });
      });
      res.on('error', reject);
    });

    req.on('error', reject);

    if (options.body) {
      req.write(options.body);
    }

    req.end();
  });
}