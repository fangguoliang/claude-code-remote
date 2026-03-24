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

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should return true for existing Unix shell', () => {
    vi.spyOn(process, 'platform', 'get').mockReturnValue('linux' as NodeJS.Platform);
    vi.mocked(fs.existsSync).mockReturnValue(true);

    expect(shellExists('/bin/bash')).toBe(true);
    expect(fs.existsSync).toHaveBeenCalledWith('/bin/bash');
  });

  it('should return false for non-existing Unix shell', () => {
    vi.spyOn(process, 'platform', 'get').mockReturnValue('linux' as NodeJS.Platform);
    vi.mocked(fs.existsSync).mockReturnValue(false);

    expect(shellExists('/bin/fish')).toBe(false);
  });

  it('should return true for Windows powershell', () => {
    vi.spyOn(process, 'platform', 'get').mockReturnValue('win32' as NodeJS.Platform);

    expect(shellExists('powershell.exe')).toBe(true);
  });

  it('should return true for Windows cmd', () => {
    vi.spyOn(process, 'platform', 'get').mockReturnValue('win32' as NodeJS.Platform);

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
    expect(result.args).toEqual([]);  // No -l flag on macOS due to posix_spawnp issue
  });

  it('should fallback to bash on macOS when zsh not found', () => {
    vi.spyOn(process, 'platform', 'get').mockReturnValue('darwin' as NodeJS.Platform);
    vi.mocked(fs.existsSync).mockImplementation((path) => {
      return path === '/bin/bash';
    });

    const result = getShell();

    expect(result.shell).toBe('/bin/bash');
    expect(result.args).toEqual([]);  // No -l flag on macOS
  });

  it('should fallback to sh on macOS when zsh and bash not found', () => {
    vi.spyOn(process, 'platform', 'get').mockReturnValue('darwin' as NodeJS.Platform);
    vi.mocked(fs.existsSync).mockReturnValue(false);

    const result = getShell();

    expect(result.shell).toBe('/bin/sh');
    expect(result.args).toEqual([]);  // No -l flag on macOS
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