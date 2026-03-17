import WebSocket from 'ws';
import { config } from './config.js';
import { PtyManager } from './pty.js';

export class Tunnel {
  private ws: WebSocket | null = null;
  private ptyManager = new PtyManager();
  private reconnectTimer: NodeJS.Timeout | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;

  connect() {
    console.log(`Connecting to ${config.serverUrl}...`);

    this.ws = new WebSocket(config.serverUrl);

    this.ws.on('open', () => {
      console.log('Connected to server');
      this.register();
      this.startHeartbeat();
    });

    this.ws.on('message', (data) => {
      this.handleMessage(data.toString());
    });

    this.ws.on('close', () => {
      console.log('Disconnected from server');
      this.stopHeartbeat();
      this.scheduleReconnect();
    });

    this.ws.on('error', (err) => {
      console.error('WebSocket error:', err.message);
    });
  }

  private register() {
    this.send({
      type: 'register',
      payload: {
        agentId: config.agentId,
        userId: config.userId,
        name: 'Windows PowerShell',
      },
      timestamp: Date.now(),
    });
  }

  private startHeartbeat() {
    this.heartbeatTimer = setInterval(() => {
      this.send({ type: 'ping', timestamp: Date.now() });
    }, config.heartbeatInterval);
  }

  private stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, config.reconnectInterval);
  }

  private handleMessage(data: string) {
    try {
      const message = JSON.parse(data);
      const { type, payload, sessionId } = message;

      switch (type) {
        case 'register:result':
          console.log('Registration result:', payload);
          break;

        case 'session:start':
          this.handleSessionStart(payload);
          break;

        case 'session:input':
          if (sessionId) {
            this.ptyManager.write(sessionId, payload.data);
          }
          break;

        case 'session:resize':
          if (sessionId) {
            this.ptyManager.resize(sessionId, payload.cols, payload.rows);
          }
          break;

        case 'session:close':
          if (sessionId) {
            this.ptyManager.close(sessionId);
          }
          break;

        case 'pong':
          break;
      }
    } catch (err) {
      console.error('Failed to handle message:', err);
    }
  }

  private handleSessionStart(payload: { sessionId: string; cols: number; rows: number }) {
    const { sessionId, cols, rows } = payload;

    this.ptyManager.create(sessionId, cols, rows, (data) => {
      this.send({
        type: 'session:output',
        sessionId,
        payload: { data },
        timestamp: Date.now(),
      });
    });

    this.send({
      type: 'session:started',
      sessionId,
      payload: { success: true },
      timestamp: Date.now(),
    });
  }

  private send(message: unknown) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  disconnect() {
    this.stopHeartbeat();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }
    if (this.ws) {
      this.ws.close();
    }
  }
}