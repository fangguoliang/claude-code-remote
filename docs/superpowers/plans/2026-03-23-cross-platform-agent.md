# Cross-Platform Agent Support Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the remoteCli agent to support Linux and macOS terminals with automatic platform detection and graceful shell fallback.

**Architecture:** Create a new `shell.ts` module that detects the platform and returns the appropriate shell with fallback chain. Modify `pty.ts` and `tunnel.ts` to use the new functions. Add service installation scripts for systemd (Linux) and launchd (macOS).

**Tech Stack:** Node.js, TypeScript, node-pty, vitest for testing

---

## File Structure

| Action | File | Purpose |
|--------|------|---------|
| Create | `packages/agent/src/shell.ts` | Shell detection and agent naming functions |
| Create | `packages/agent/src/__tests__/shell.test.ts` | Unit tests for shell.ts |
| Modify | `packages/agent/src/pty.ts:17-24` | Use getShell() instead of hardcoded powershell |
| Modify | `packages/agent/src/tunnel.ts:40-50` | Use getAgentName() instead of hardcoded name |
| Modify | `packages/agent/package.json` | Add vitest and test scripts |
| Create | `packages/agent/scripts/install-service.sh` | Service installation script |
| Create | `packages/agent/scripts/uninstall-service.sh` | Service uninstallation script |
| Create | `packages/agent/templates/remotecli-agent.service` | systemd service template |
| Create | `packages/agent/templates/com.remotecli.agent.plist` | launchd plist template |

---

## Task 1: Add Testing Infrastructure

**Files:**
- Modify: `packages/agent/package.json`

- [ ] **Step 1: Add vitest dependency and test scripts to package.json**

Update `packages/agent/package.json`:

```json
{
  "name": "@remotecli/agent",
  "version": "0.1.0",
  "type": "module",
  "main": "./dist/index.js",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "@remotecli/shared": "workspace:*",
    "node-pty": "^1.0.0",
    "ws": "^8.16.0",
    "dotenv": "^16.4.0"
  },
  "devDependencies": {
    "@types/node": "^20.11.0",
    "@types/ws": "^8.5.10",
    "tsx": "^4.7.0",
    "typescript": "^5.3.0",
    "vitest": "^1.2.0"
  }
}
```

- [ ] **Step 2: Install the dependency**

Run: `cd packages/agent && pnpm install`

Expected: vitest installed successfully

- [ ] **Step 3: Commit**

```bash
git add packages/agent/package.json pnpm-lock.yaml
git commit -m "chore(agent): add vitest for testing"
```

---

## Task 2: Create Shell Module with Tests

**Files:**
- Create: `packages/agent/src/shell.ts`
- Create: `packages/agent/src/__tests__/shell.test.ts`

- [ ] **Step 1: Write failing tests for shell detection**

Create `packages/agent/src/__tests__/shell.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import { getShell, shellExists, getAgentName } from '../shell.js';

// Mock modules
vi.mock('fs');
vi.mock('os');

describe('shellExists', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('should return true for existing Unix shell', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);

    expect(shellExists('/bin/bash')).toBe(true);
    expect(fs.existsSync).toHaveBeenCalledWith('/bin/bash');
  });

  it('should return false for non-existing Unix shell', () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);

    expect(shellExists('/bin/fish')).toBe(false);
  });

  it('should return true for Windows powershell', () => {
    expect(shellExists('powershell.exe')).toBe(true);
  });

  it('should return true for Windows cmd', () => {
    expect(shellExists('cmd.exe')).toBe(true);
  });
});

describe('getShell', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should return powershell on Windows when available', () => {
    vi.spyOn(process, 'platform', 'get').mockReturnValue('win32' as NodeJS.Platform);

    const result = getShell();

    expect(result.shell).toBe('powershell.exe');
    expect(result.args).toEqual([]);
  });

  it('should return zsh on macOS when available', () => {
    vi.spyOn(process, 'platform', 'get').mockReturnValue('darwin' as NodeJS.Platform);
    vi.mocked(fs.existsSync).mockReturnValue(true);

    const result = getShell();

    expect(result.shell).toBe('/bin/zsh');
    expect(result.args).toEqual(['-l']);
  });

  it('should fallback to bash on macOS when zsh not found', () => {
    vi.spyOn(process, 'platform', 'get').mockReturnValue('darwin' as NodeJS.Platform);
    vi.mocked(fs.existsSync).mockImplementation((path) => {
      return path === '/bin/bash';
    });

    const result = getShell();

    expect(result.shell).toBe('/bin/bash');
    expect(result.args).toEqual(['-l']);
  });

  it('should fallback to sh on macOS when zsh and bash not found', () => {
    vi.spyOn(process, 'platform', 'get').mockReturnValue('darwin' as NodeJS.Platform);
    vi.mocked(fs.existsSync).mockReturnValue(false);

    const result = getShell();

    expect(result.shell).toBe('/bin/sh');
    expect(result.args).toEqual(['-l']);
  });

  it('should return bash on Linux when available', () => {
    vi.spyOn(process, 'platform', 'get').mockReturnValue('linux' as NodeJS.Platform);
    vi.mocked(fs.existsSync).mockReturnValue(true);

    const result = getShell();

    expect(result.shell).toBe('/bin/bash');
    expect(result.args).toEqual(['-l']);
  });

  it('should fallback to sh on Linux when bash not found', () => {
    vi.spyOn(process, 'platform', 'get').mockReturnValue('linux' as NodeJS.Platform);
    vi.mocked(fs.existsSync).mockReturnValue(false);

    const result = getShell();

    expect(result.shell).toBe('/bin/sh');
    expect(result.args).toEqual(['-l']);
  });
});

describe('getAgentName', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('should return Windows with hostname on Windows', () => {
    vi.spyOn(process, 'platform', 'get').mockReturnValue('win32' as NodeJS.Platform);
    vi.mocked(os.hostname).mockReturnValue('DESKTOP-ABC');

    expect(getAgentName()).toBe('Windows (DESKTOP-ABC)');
  });

  it('should return macOS with hostname on macOS', () => {
    vi.spyOn(process, 'platform', 'get').mockReturnValue('darwin' as NodeJS.Platform);
    vi.mocked(os.hostname).mockReturnValue('MacBook-Pro');

    expect(getAgentName()).toBe('macOS (MacBook-Pro)');
  });

  it('should return Linux with hostname on Linux', () => {
    vi.spyOn(process, 'platform', 'get').mockReturnValue('linux' as NodeJS.Platform);
    vi.mocked(os.hostname).mockReturnValue('my-server');

    expect(getAgentName()).toBe('Linux (my-server)');
  });

  it('should handle unknown platform gracefully', () => {
    vi.spyOn(process, 'platform', 'get').mockReturnValue('freebsd' as NodeJS.Platform);
    vi.mocked(os.hostname).mockReturnValue('bsd-server');

    expect(getAgentName()).toBe('freebsd (bsd-server)');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/agent && pnpm test`

Expected: Tests fail with "Cannot find module '../shell.js'"

- [ ] **Step 3: Create shell.ts implementation**

Create `packages/agent/src/shell.ts`:

```typescript
import * as fs from 'fs';
import * as os from 'os';

export interface ShellConfig {
  shell: string;
  args: string[];
}

/**
 * Check if a shell executable exists
 * On Unix: Check if the file exists at the given path
 * On Windows: Check if the executable exists (simplified check)
 */
export function shellExists(shell: string): boolean {
  try {
    if (process.platform === 'win32') {
      // On Windows, powershell.exe and cmd.exe should always exist
      return shell === 'powershell.exe' || shell === 'cmd.exe';
    }
    // On Unix, check if the file exists
    return fs.existsSync(shell);
  } catch {
    return false;
  }
}

/**
 * Get the appropriate shell for the current platform
 * Returns the shell path and arguments to use
 */
export function getShell(): ShellConfig {
  const platform = process.platform;

  if (platform === 'win32') {
    // Windows: PowerShell -> cmd (powershell always exists on modern Windows)
    return { shell: 'powershell.exe', args: [] };
  }

  if (platform === 'darwin') {
    // macOS: zsh -> bash -> sh
    if (shellExists('/bin/zsh')) {
      return { shell: '/bin/zsh', args: ['-l'] };
    }
    if (shellExists('/bin/bash')) {
      return { shell: '/bin/bash', args: ['-l'] };
    }
    return { shell: '/bin/sh', args: ['-l'] };
  }

  // Linux and other Unix: bash -> sh
  if (shellExists('/bin/bash')) {
    return { shell: '/bin/bash', args: ['-l'] };
  }
  return { shell: '/bin/sh', args: ['-l'] };
}

/**
 * Get the agent name based on platform and hostname
 * Format: "Platform (hostname)"
 */
export function getAgentName(): string {
  const platform = process.platform;
  const hostname = os.hostname();

  const platformNames: Record<string, string> = {
    'win32': 'Windows',
    'darwin': 'macOS',
    'linux': 'Linux',
  };

  const platformName = platformNames[platform] || platform;
  return `${platformName} (${hostname})`;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/agent && pnpm test`

Expected: All tests pass

- [ ] **Step 5: Commit**

```bash
git add packages/agent/src/shell.ts packages/agent/src/__tests__/shell.test.ts
git commit -m "feat(agent): add cross-platform shell detection module"
```

---

## Task 3: Update PtyManager to Use Dynamic Shell

**Files:**
- Modify: `packages/agent/src/pty.ts`

- [ ] **Step 1: Update pty.ts imports**

Add import for getShell at the top of `packages/agent/src/pty.ts`:

```typescript
import * as pty from 'node-pty';
import { getShell } from './shell.js';
```

- [ ] **Step 2: Update PtyManager.create() method**

Replace the hardcoded shell in the create method. Change:

```typescript
const ptyProcess = pty.spawn('powershell.exe', [], {
  name: 'xterm-256color',
  cols,
  rows,
  cwd: process.env.USERPROFILE || process.cwd(),
  env: process.env as { [key: string]: string },
});
```

To:

```typescript
const { shell, args } = getShell();
const cwd = process.platform === 'win32'
  ? (process.env.USERPROFILE || process.cwd())
  : (process.env.HOME || process.cwd());

const ptyProcess = pty.spawn(shell, args, {
  name: 'xterm-256color',
  cols,
  rows,
  cwd,
  env: process.env as { [key: string]: string },
});
```

- [ ] **Step 3: Verify build succeeds**

Run: `cd packages/agent && pnpm build`

Expected: TypeScript compilation succeeds with no errors

- [ ] **Step 4: Commit**

```bash
git add packages/agent/src/pty.ts
git commit -m "feat(agent): use dynamic shell selection in PtyManager"
```

---

## Task 4: Update Tunnel to Use Dynamic Agent Name

**Files:**
- Modify: `packages/agent/src/tunnel.ts`

- [ ] **Step 1: Update tunnel.ts imports**

Add import for getAgentName at the top of `packages/agent/src/tunnel.ts`:

```typescript
import WebSocket from 'ws';
import { config } from './config.js';
import { PtyManager } from './pty.js';
import { FileManager } from './file.js';
import { getAgentName } from './shell.js';
```

- [ ] **Step 2: Update register() method**

Change line 46 from:
```typescript
name: 'Windows PowerShell',
```

To:
```typescript
name: getAgentName(),
```

- [ ] **Step 3: Verify build succeeds**

Run: `cd packages/agent && pnpm build`

Expected: TypeScript compilation succeeds with no errors

- [ ] **Step 4: Commit**

```bash
git add packages/agent/src/tunnel.ts
git commit -m "feat(agent): use dynamic agent name with platform and hostname"
```

---

## Task 5: Create Service Templates

**Files:**
- Create: `packages/agent/templates/remotecli-agent.service`
- Create: `packages/agent/templates/com.remotecli.agent.plist`

- [ ] **Step 1: Create systemd service template**

Create `packages/agent/templates/remotecli-agent.service`:

```ini
[Unit]
Description=remoteCli Agent - Remote Terminal Access
After=network.target
Wants=network-online.target

[Service]
Type=simple
User=%USER%
WorkingDirectory=%INSTALL_DIR%
ExecStart=%NODE_PATH% %INSTALL_DIR%/dist/index.js
Restart=on-failure
RestartSec=10
StandardOutput=journal
StandardError=journal
Environment=NODE_ENV=production
EnvironmentFile=%INSTALL_DIR%/.env

[Install]
WantedBy=multi-user.target
```

- [ ] **Step 2: Create launchd plist template**

Create `packages/agent/templates/com.remotecli.agent.plist`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.remotecli.agent</string>
    <key>ProgramArguments</key>
    <array>
        <string>%NODE_PATH%</string>
        <string>%INSTALL_DIR%/dist/index.js</string>
    </array>
    <key>WorkingDirectory</key>
    <string>%INSTALL_DIR%</string>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>/tmp/remotecli-agent.log</string>
    <key>StandardErrorPath</key>
    <string>/tmp/remotecli-agent.log</string>
    <key>EnvironmentVariables</key>
    <dict>
        <key>NODE_ENV</key>
        <string>production</string>
    </dict>
</dict>
</plist>
```

- [ ] **Step 3: Commit**

```bash
git add packages/agent/templates/
git commit -m "feat(agent): add systemd and launchd service templates"
```

---

## Task 6: Create Service Installation Scripts

**Files:**
- Create: `packages/agent/scripts/install-service.sh`
- Create: `packages/agent/scripts/uninstall-service.sh`

- [ ] **Step 1: Create install-service.sh**

Create `packages/agent/scripts/install-service.sh`:

```bash
#!/bin/bash

# remoteCli Agent Service Installation Script
# Supports: Linux (systemd) and macOS (launchd)

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INSTALL_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
USER=$(whoami)
NODE_PATH=$(which node)

echo "=== remoteCli Agent Service Installer ==="
echo "Install directory: $INSTALL_DIR"
echo "User: $USER"
echo "Node path: $NODE_PATH"
echo ""

# Detect OS and install
if [[ "$OSTYPE" == "linux-gnu"* ]]; then
    echo "Detected: Linux (systemd)"

    # Check if systemd is available
    if ! command -v systemctl &> /dev/null; then
        echo "Error: systemctl not found. systemd is required."
        exit 1
    fi

    SERVICE_FILE="/etc/systemd/system/remotecli-agent.service"

    # Create service file from template
    echo "Creating service file..."
    sed -e "s|%USER%|$USER|g" \
        -e "s|%INSTALL_DIR%|$INSTALL_DIR|g" \
        -e "s|%NODE_PATH%|$NODE_PATH|g" \
        "$INSTALL_DIR/templates/remotecli-agent.service" | sudo tee "$SERVICE_FILE" > /dev/null

    # Set permissions
    sudo chmod 644 "$SERVICE_FILE"

    # Reload systemd
    echo "Reloading systemd daemon..."
    sudo systemctl daemon-reload

    # Enable service
    echo "Enabling service..."
    sudo systemctl enable remotecli-agent

    # Start service
    echo "Starting service..."
    sudo systemctl start remotecli-agent

    # Show status
    echo ""
    echo "Service installed successfully!"
    echo ""
    sudo systemctl status remotecli-agent --no-pager

elif [[ "$OSTYPE" == "darwin"* ]]; then
    echo "Detected: macOS (launchd)"

    PLIST_FILE="$HOME/Library/LaunchAgents/com.remotecli.agent.plist"

    # Create LaunchAgents directory if it doesn't exist
    mkdir -p "$HOME/Library/LaunchAgents"

    # Create plist file from template
    echo "Creating launchd plist..."
    sed -e "s|%INSTALL_DIR%|$INSTALL_DIR|g" \
        -e "s|%NODE_PATH%|$NODE_PATH|g" \
        "$INSTALL_DIR/templates/com.remotecli.agent.plist" > "$PLIST_FILE"

    # Load the service
    echo "Loading service..."
    launchctl load "$PLIST_FILE"

    echo ""
    echo "Service installed successfully!"
    echo ""
    echo "To check status: launchctl list | grep remotecli"
    echo "To view logs: tail -f /tmp/remotecli-agent.log"
else
    echo "Error: Unsupported OS: $OSTYPE"
    echo "This script only supports Linux (systemd) and macOS (launchd)"
    exit 1
fi

echo ""
echo "Installation complete!"
```

- [ ] **Step 2: Make install script executable**

Run: `chmod +x packages/agent/scripts/install-service.sh`

- [ ] **Step 3: Create uninstall-service.sh**

Create `packages/agent/scripts/uninstall-service.sh`:

```bash
#!/bin/bash

# remoteCli Agent Service Uninstallation Script
# Supports: Linux (systemd) and macOS (launchd)

set -e

echo "=== remoteCli Agent Service Uninstaller ==="
echo ""

# Detect OS and uninstall
if [[ "$OSTYPE" == "linux-gnu"* ]]; then
    echo "Detected: Linux (systemd)"

    SERVICE_FILE="/etc/systemd/system/remotecli-agent.service"

    if [ -f "$SERVICE_FILE" ]; then
        echo "Stopping service..."
        sudo systemctl stop remotecli-agent || true

        echo "Disabling service..."
        sudo systemctl disable remotecli-agent || true

        echo "Removing service file..."
        sudo rm -f "$SERVICE_FILE"

        echo "Reloading systemd daemon..."
        sudo systemctl daemon-reload

        echo ""
        echo "Service uninstalled successfully!"
    else
        echo "Service not installed."
    fi

elif [[ "$OSTYPE" == "darwin"* ]]; then
    echo "Detected: macOS (launchd)"

    PLIST_FILE="$HOME/Library/LaunchAgents/com.remotecli.agent.plist"

    if [ -f "$PLIST_FILE" ]; then
        echo "Unloading service..."
        launchctl unload "$PLIST_FILE" || true

        echo "Removing plist file..."
        rm -f "$PLIST_FILE"

        echo ""
        echo "Service uninstalled successfully!"
    else
        echo "Service not installed."
    fi
else
    echo "Error: Unsupported OS: $OSTYPE"
    echo "This script only supports Linux (systemd) and macOS (launchd)"
    exit 1
fi

echo ""
echo "Uninstallation complete!"
```

- [ ] **Step 4: Make uninstall script executable**

Run: `chmod +x packages/agent/scripts/uninstall-service.sh`

- [ ] **Step 5: Commit**

```bash
git add packages/agent/scripts/
git commit -m "feat(agent): add service installation scripts for Linux and macOS"
```

---

## Task 7: Final Verification and Push

- [ ] **Step 1: Run all tests**

Run: `cd packages/agent && pnpm test`

Expected: All tests pass

- [ ] **Step 2: Build all packages**

Run: `pnpm build`

Expected: All packages build successfully

- [ ] **Step 3: Push to GitHub**

```bash
git push origin master
```

---

## Summary

| Task | Description | Files Changed |
|------|-------------|---------------|
| 1 | Add testing infrastructure | `package.json` |
| 2 | Create shell module with tests | `shell.ts`, `shell.test.ts` |
| 3 | Update PtyManager | `pty.ts` |
| 4 | Update Tunnel | `tunnel.ts` |
| 5 | Create service templates | `templates/*.service`, `templates/*.plist` |
| 6 | Create service scripts | `scripts/*.sh` |
| 7 | Final verification | - |