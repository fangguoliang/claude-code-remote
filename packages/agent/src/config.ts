import 'dotenv/config';

export const config = {
  serverUrl: process.env.SERVER_URL || 'ws://localhost:3000/ws/agent',
  agentId: process.env.AGENT_ID || crypto.randomUUID(),
  agentSecret: process.env.AGENT_SECRET || 'dev-secret',
  userId: parseInt(process.env.USER_ID || '1', 10),
  reconnectInterval: 5000,
  heartbeatInterval: 30000,
};