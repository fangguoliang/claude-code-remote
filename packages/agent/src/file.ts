import * as fs from 'fs/promises';
import * as path from 'path';
import type { FileEntry } from '@ccremote/shared';

export class FileManager {
  async browse(dirPath: string): Promise<FileEntry[]> {
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      const result: FileEntry[] = [];

      for (const entry of entries) {
        const fileEntry: FileEntry = {
          name: entry.name,
          isDirectory: entry.isDirectory(),
        };

        if (!entry.isDirectory()) {
          try {
            const stat = await fs.stat(path.join(dirPath, entry.name));
            fileEntry.size = stat.size;
            fileEntry.modifiedAt = stat.mtimeMs;
          } catch {
            // 忽略无法访问的文件
          }
        }

        result.push(fileEntry);
      }

      // 目录在前，然后按名称排序
      result.sort((a, b) => {
        if (a.isDirectory !== b.isDirectory) {
          return a.isDirectory ? -1 : 1;
        }
        return a.name.localeCompare(b.name);
      });

      return result;
    } catch (err: unknown) {
      const error = err as { code?: string };
      if (error.code === 'ENOENT') {
        throw new Error('DIR_NOT_FOUND');
      }
      if (error.code === 'EACCES') {
        throw new Error('PERMISSION_DENIED');
      }
      throw err;
    }
  }
}