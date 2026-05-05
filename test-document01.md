# 远程终端系统使用指南

## 简介

这是一个基于 Web 的远程 PowerShell 终端系统，让你可以通过手机浏览器访问 Windows 电脑的 PowerShell 终端。

## 系统架构

```
手机浏览器 <--WebSocket--> 云服务器 <--WebSocket--> Windows Agent
```

### 核心组件

| 组件 | 说明 | 运行环境 |
|------|------|----------|
| Server | 云端服务器，负责消息路由 | Linux (Node.js) |
| Agent | Windows 代理，负责创建终端 | Windows (Node.js) |
| Web | 移动端网页界面 | 浏览器 (Vue 3) |

## 快速开始

### 1. 安装依赖

```bash
pnpm install
```

### 2. 配置环境变量

```bash
# 服务器配置
cp packages/server/.env.example packages/server/.env

# 代理配置
cp packages/agent/.env.example packages/agent/.env
```

### 3. 启动开发环境

```bash
# 启动所有服务
pnpm dev
```

## 功能特性

### 终端会话

- 支持多个终端会话同时运行
- 支持会话持久化，断开连接后自动缓存输出
- 支持终端窗口大小自适应调整

### 连接管理

- 支持心跳保活检测
- 支持自动重连机制
- 支持多用户隔离

## 常见问题

### Q: Agent 无法连接服务器？

A: 检查以下几点：

1. `SERVER_URL` 配置是否正确
2. 服务器端口是否开放
3. 网络防火墙是否放行

### Q: 终端显示乱码？

A: 确保 PowerShell 输出编码为 UTF-8：

```powershell
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
```

---

> **提示**: 部署到生产环境时，请务必配置 `JWT_SECRET` 并使用 HTTPS。

## 跨行文本测试

这是一段测试跨行显示的文本：

第一行文本内容，用于测试排版。
第二行文本内容，继续验证效果。
第三行文本内容，确保换行正常。

测试文件完整路径如下 `D:\claudeworkspace\remoteCli\very\long\path\to\test\document\test-document.md` 请确认是否正常换行
