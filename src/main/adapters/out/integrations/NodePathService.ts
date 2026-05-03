import path from 'node:path';
import type { IPathService } from '../../../domain';

export class NodePathService implements IPathService {
  readonly separator = path.sep;

  join(...parts: string[]): string {
    return path.join(...parts);
  }

  basename(filePath: string, suffix?: string): string {
    return suffix === undefined ? path.basename(filePath) : path.basename(filePath, suffix);
  }

  dirname(filePath: string): string {
    return path.dirname(filePath);
  }

  relative(from: string, to: string): string {
    return path.relative(from, to);
  }

  isAbsolute(filePath: string): boolean {
    return path.isAbsolute(filePath);
  }

  resolve(filePath: string): string {
    return path.resolve(filePath);
  }

  extname(filePath: string): string {
    return path.extname(filePath);
  }
}
