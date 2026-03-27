import 'dotenv/config';

export const config = {
  serverUrl: process.env.SERVER_URL || 'ws://localhost:3000/ws/agent',
  agentId: process.env.AGENT_ID || crypto.randomUUID(),
  agentSecret: process.env.AGENT_SECRET || 'dev-secret',
  username: process.env.AGENT_USERNAME || 'admin',  // 使用 AGENT_USERNAME，避免与系统 USERNAME 冲突
  reconnectInterval: 5000,
  heartbeatInterval: 30000,
};