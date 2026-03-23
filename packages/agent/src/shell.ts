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