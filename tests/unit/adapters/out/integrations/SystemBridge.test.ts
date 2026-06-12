import { beforeEach, describe, expect, it, vi } from 'vitest';

const fontListMock = vi.hoisted(() => ({
  getFonts: vi.fn().mockResolvedValue(['Zed Sans', 'Avenir']),
}));

vi.mock('font-list', () => fontListMock);

async function loadSystemBridge() {
  vi.resetModules();
  const { SystemBridge } = await import('../../../../../src/main/adapters/out/integrations/SystemBridge');
  return new SystemBridge();
}

describe('SystemBridge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fontListMock.getFonts.mockResolvedValue(['Zed Sans', 'Avenir']);
  });

  it('resolves the default workspace directory from config or documents', async () => {
    const bridge = await loadSystemBridge();

    expect(bridge.getDefaultWorkspaceDir('/custom/Stone')).toBe('/custom/Stone');
    expect(bridge.getDefaultWorkspaceDir()).toContain('/Documents/Stone');
  });

  it('returns sorted fonts and falls back when font-list fails', async () => {
    const bridge = await loadSystemBridge();

    await expect(bridge.getFonts()).resolves.toEqual(['Avenir', 'Zed Sans']);

    fontListMock.getFonts.mockRejectedValueOnce(new Error('font scan failed'));
    await expect(bridge.getFonts()).resolves.toContain('Arial');
  });

  it('handles microphone status and permission requests', async () => {
    const bridge = await loadSystemBridge();

    expect(bridge.getMicrophoneAccessStatus()).toBe('unknown');
    await expect(bridge.askForMicrophoneAccess()).resolves.toBe(true);
  });

  it('throws or no-ops for Electron-only operations outside Electron', async () => {
    const bridge = await loadSystemBridge();

    await expect(bridge.selectFolder({ title: 'Pick' })).rejects.toThrow(
      'Folder selection not available outside Electron',
    );
    await expect(bridge.selectFile({ multiSelect: true })).rejects.toThrow(
      'File selection not available outside Electron',
    );
    await expect(bridge.selectSaveLocation({ defaultPath: '/tmp/out.md' })).rejects.toThrow(
      'Save dialog not available outside Electron',
    );
    bridge.showInFolder('/tmp/out.md');
    await expect(bridge.openExternal('https://example.com')).rejects.toThrow(
      'Shell not available outside Electron',
    );
  });

  it('validates filesystem paths', async () => {
    const bridge = await loadSystemBridge();

    await expect(bridge.validatePath(process.cwd())).resolves.toBe(true);
    await expect(bridge.validatePath('/definitely/not/a/stone/path')).resolves.toBe(false);
  });
});
