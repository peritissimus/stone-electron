import { vi } from 'vitest';
import type { IIdGenerator } from '../../../../src/main/domain/ports/out/IIdGenerator';
import type { IPathService } from '../../../../src/main/domain/ports/out/IPathService';

export function createMockIdGenerator(): IIdGenerator {
  return {
    generate: vi.fn(() => 'generated-id'),
  };
}

export function createMockPathService(): IPathService {
  return {
    separator: '/',
    join: (...parts: string[]) => parts.filter(Boolean).join('/').replace(/\/+/g, '/'),
    basename: (filePath: string, suffix?: string) => {
      const name = filePath.split('/').filter(Boolean).at(-1) ?? '';
      return suffix && name.endsWith(suffix) ? name.slice(0, -suffix.length) : name;
    },
    dirname: (filePath: string) => {
      const parts = filePath.split('/').filter(Boolean);
      if (parts.length <= 1) return filePath.startsWith('/') ? '/' : '.';
      const prefix = filePath.startsWith('/') ? '/' : '';
      return `${prefix}${parts.slice(0, -1).join('/')}`;
    },
    relative: (from: string, to: string) => {
      const normalizedFrom = from.replace(/\/+$/, '');
      return to.startsWith(`${normalizedFrom}/`) ? to.slice(normalizedFrom.length + 1) : to;
    },
    isAbsolute: (filePath: string) => filePath.startsWith('/'),
    resolve: (filePath: string) => (filePath.startsWith('/') ? filePath : `/${filePath}`),
    extname: (filePath: string) => {
      const name = filePath.split('/').filter(Boolean).at(-1) ?? '';
      const dotIndex = name.lastIndexOf('.');
      return dotIndex > 0 ? name.slice(dotIndex) : '';
    },
  };
}
