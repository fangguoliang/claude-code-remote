// packages/server/src/ws/tunnel.ts
import WebSocket from 'ws';
import { agentModel } from '../db/index.js';

interface AgentConnection {
  ws: WebSocket;
  agentId: string;
  userId: number;
  sessions: Map<string, WebSocket>; // sessionId -> browser ws
}

interface BrowserConnection {
  ws: WebSocket;
  userId: number;
  agentId: string | null;
  sessionId: string | null;
}

class TunnelManager {
  private agents = new Map<string, AgentConnection>();
  private browsers = new Map<WebSocket, BrowserConnection>();
  // Store session -> agentId mapping for session resumption
  private sessionAgents = new Map<string, string>();

  // Agent 注册
  registerAgent(ws: WebSocket, agentId: string, userId: number) {
    const conn: AgentConnection = {
      ws,
      agentId,
      userId,
      sessions: new Map(),
    };
    this.agents.set(agentId, conn);
    agentModel.updateLastSeen(agentId);
    console.log(`Agent registered: ${agentId}`);
  }

  // Agent 断开
  unregisterAgent(agentId: string) {
    const agent = this.agents.get(agentId);
    if (agent) {
      // Close all browser sessions for this agent
      for (const [sessionId, browserWs] of agent.sessions) {
        browserWs.send(JSON.stringify({
          type: 'session:closed',
          sessionId,
          payload: { reason: 'Agent disconnected' },
          timestamp: Date.now(),
        }));
        // Clean up session mapping
        this.sessionAgents.delete(sessionId);
      }
      this.agents.delete(agentId);
    }
    console.log(`Agent unregistered: ${agentId}`);
  }

  // 浏览器连接
  connectBrowser(ws: WebSocket, userId: number) {
    const conn: BrowserConnection = {
      ws,
      userId,
      agentId: null,
      sessionId: null,
    };
    this.browsers.set(ws, conn);
  }

  // 浏览器断开 - 不再关闭会话，而是暂停会话
  disconnectBrowser(ws: WebSocket) {
    const browser = this.browsers.get(ws);
    if (browser && browser.agentId && browser.sessionId) {
      // Store session -> agentId mapping for potential resume
      this.sessionAgents.set(browser.sessionId, browser.agentId);

      // Send session:pause to Agent instead of session:close
      const agent = this.agents.get(browser.agentId);
      if (agent) {
        agent.sessions.delete(browser.sessionId);
        agent.ws.send(JSON.stringify({
          type: 'session:pause',
          sessionId: browser.sessionId,
          payload: {},
          timestamp: Date.now(),
        }));
      }
    }
    this.browsers.delete(ws);
  }

  // 恢复会话
  resumeSession(browserWs: WebSocket, sessionId: string): { success: boolean; agentId?: string; error?: string } {
    const agentId = this.sessionAgents.get(sessionId);
    if (!agentId) {
      return { success: false, error: 'Session not found' };
    }

    const agent = this.agents.get(agentId);
    if (!agent) {
      // Agent is offline, clean up the session mapping
      this.sessionAgents.delete(sessionId);
      return { success: false, error: 'Agent not connected' };
    }

    const browser = this.browsers.get(browserWs);
    if (!browser) {
      return { success: false, error: 'Browser not connected' };
    }

    // Re-bind browser to the session
    browser.sessionId = sessionId;
    browser.agentId = agentId;
    agent.sessions.set(sessionId, browserWs);

    return { success: true, agentId };
  }

  // 绑定浏览器到 Agent
  bindBrowserToAgent(ws: WebSocket, agentId: string): boolean {
    const browser = this.browsers.get(ws);
    if (browser && this.agents.has(agentId)) {
      browser.agentId = agentId;
      return true;
    }
    return false;
  }

  // 创建会话
  createSession(browserWs: WebSocket, sessionId: string): boolean {
    const browser = this.browsers.get(browserWs);
    if (!browser || !browser.agentId) return false;

    const agent = this.agents.get(browser.agentId);
    if (!agent) return false;

    browser.sessionId = sessionId;
    agent.sessions.set(sessionId, browserWs);
    return true;
  }

  // 路由消息：浏览器 -> Agent
  routeToAgent(agentId: string, message: unknown): boolean {
    const agent = this.agents.get(agentId);
    if (!agent || agent.ws.readyState !== WebSocket.OPEN) return false;

    agent.ws.send(JSON.stringify(message));
    return true;
  }

  // 路由消息：Agent -> 浏览器
  routeToBrowser(sessionId: string, message: unknown): boolean {
    for (const agent of this.agents.values()) {
      const browserWs = agent.sessions.get(sessionId);
      if (browserWs && browserWs.readyState === WebSocket.OPEN) {
        browserWs.send(JSON.stringify(message));
        return true;
      }
    }
    return false;
  }

  // 获取浏览器连接
  getBrowser(ws: WebSocket): BrowserConnection | undefined {
    return this.browsers.get(ws);
  }

  // 获取用户可用的 Agent 列表
  getUserAgents(userId: number) {
    return agentModel.findByUserId(userId);
  }

  // 检查 Agent 是否在线
  isAgentOnline(agentId: string): boolean {
    return this.agents.has(agentId);
  }

  // 获取在线 Agents
  getOnlineAgents(): string[] {
    return Array.from(this.agents.keys());
  }
}

export const tunnelManager = new TunnelManager();
export type { AgentConnection, BrowserConnection };