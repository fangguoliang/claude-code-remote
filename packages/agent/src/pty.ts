import * as pty from 'node-pty';

export interface PtySession {
  pty: pty.IPty;
  sessionId: string;
  cols: number;
  rows: number;
}

export class PtyManager {
  private sessions = new Map<string, PtySession>();

  create(sessionId: string, cols: number = 80, rows: number = 24, onData: (data: string) => void): PtySession {
    const ptyProcess = pty.spawn('powershell.exe', [], {
      name: 'xterm-256color',
      cols,
      rows,
      cwd: process.env.USERPROFILE || process.cwd(),
      env: process.env as { [key: string]: string },
    });

    ptyProcess.onData((data) => {
      onData(data);
    });

    ptyProcess.onExit(({ exitCode }) => {
      console.log(`Session ${sessionId} exited with code ${exitCode}`);
      this.sessions.delete(sessionId);
    });

    const session: PtySession = {
      pty: ptyProcess,
      sessionId,
      cols,
      rows,
    };

    this.sessions.set(sessionId, session);
    return session;
  }

  write(sessionId: string, data: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;
    session.pty.write(data);
    return true;
  }

  resize(sessionId: string, cols: number, rows: number): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;
    session.pty.resize(cols, rows);
    session.cols = cols;
    session.rows = rows;
    return true;
  }

  close(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;
    session.pty.kill();
    this.sessions.delete(sessionId);
    return true;
  }

  get(sessionId: string): PtySession | undefined {
    return this.sessions.get(sessionId);
  }
}