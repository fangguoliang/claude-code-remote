// packages/shared/src/types.ts

// WebSocket 消息类型
export type MessageType =
  | 'auth'
  | 'auth:result'
  | 'register'
  | 'register:result'
  | 'session:create'
  | 'session:start'
  | 'session:input'
  | 'session:output'
  | 'session:resize'
  | 'session:close'
  | 'ping'
  | 'pong';

export interface Message {
  type: MessageType;
  payload: unknown;
  sessionId?: string;
  timestamp: number;
}

// 认证相关
export interface AuthPayload {
  username: string;
  password: string;
}

export interface AuthResultPayload {
  success: boolean;
  accessToken?: string;
  refreshToken?: string;
  error?: string;
}

// Agent 注册
export interface RegisterPayload {
  agentId: string;
  secret: string;
  name?: string;
}

// 会话相关
export interface SessionStartPayload {
  sessionId: string;
  cols: number;
  rows: number;
}

export interface SessionInputPayload {
  data: string;
}

export interface SessionOutputPayload {
  data: string;
}

export interface SessionResizePayload {
  cols: number;
  rows: number;
}

// 用户配置
export interface TerminalSettings {
  theme: 'dark' | 'light';
  fontFamily: string;
  fontSize: number;
}