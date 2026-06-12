import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { NodePathService } from '../../../../../src/main/adapters/out/integrations/NodePathService';

describe('NodePathService', () => {
  it('delegates path operations to the Node path implementation', () => {
    const service = new NodePathService();

    expect(service.separator).toBe(path.sep);
    expect(service.join('/tmp', 'stone', 'note.md')).toBe(path.join('/tmp', 'stone', 'note.md'));
    expect(service.basename('/tmp/stone/note.md', '.md')).toBe('note');
    expect(service.dirname('/tmp/stone/note.md')).toBe(path.dirname('/tmp/stone/note.md'));
    expect(service.relative('/tmp', '/tmp/stone/note.md')).toBe(path.relative('/tmp', '/tmp/stone/note.md'));
    expect(service.isAbsolute('/tmp/stone')).toBe(path.isAbsolute('/tmp/stone'));
    expect(service.resolve('stone.md')).toBe(path.resolve('stone.md'));
    expect(service.extname('/tmp/stone/note.md')).toBe('.md');
  });
});
