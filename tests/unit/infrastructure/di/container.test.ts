import { beforeEach, describe, expect, it, vi } from 'vitest';

const electronMock = vi.hoisted(() => ({
  handleSpy: vi.fn(),
  removeHandlerSpy: vi.fn(),
  ipcMain: {
    handle: undefined as any,
    removeHandler: undefined as any,
  },
  app: {
    getPath: vi.fn(() => '/tmp/stone-container'),
    isPackaged: false,
  },
  dialog: {
    showOpenDialog: vi.fn(),
    showSaveDialog: vi.fn(),
  },
  shell: {
    showItemInFolder: vi.fn(),
    openExternal: vi.fn(),
  },
  safeStorage: {
    isEncryptionAvailable: vi.fn(() => true),
    encryptString: vi.fn((value: string) => Buffer.from(value)),
    decryptString: vi.fn((value: Buffer) => value.toString()),
  },
  systemPreferences: {
    getMediaAccessStatus: vi.fn(() => 'unknown'),
    askForMediaAccess: vi.fn().mockResolvedValue(true),
  },
}));

electronMock.ipcMain.handle = electronMock.handleSpy;
electronMock.ipcMain.removeHandler = electronMock.removeHandlerSpy;

vi.mock('electron', () => electronMock);

function perfMonitor() {
  return {
    recordIPCCall: vi.fn(),
    getSnapshot: vi.fn(() => ({
      startup: {},
      ipc: {},
      database: {},
    })),
    getMemoryMetrics: vi.fn(),
    getCPUMetrics: vi.fn(),
    getIPCMetrics: vi.fn(),
    getDatabaseMetrics: vi.fn(),
    clearHistory: vi.fn(),
    getRendererMetrics: vi.fn(),
  };
}

async function loadRuntimeModule() {
  vi.resetModules();
  return import('../../../../src/main/infrastructure/di/applicationRuntime');
}

describe('application runtime composition', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    electronMock.ipcMain.handle = electronMock.handleSpy;
    electronMock.ipcMain.removeHandler = electronMock.removeHandlerSpy;
  });

  it('creates all public container slots and exposes workspace path helpers', async () => {
    const {
      createApplicationRuntime,
      getActiveWorkspacePath,
      setActiveWorkspacePath,
    } = await loadRuntimeModule();
    const monitor = perfMonitor();

    setActiveWorkspacePath('/workspace');
    const runtime = createApplicationRuntime({
      db: {} as any,
      perfMonitor: monitor as any,
    });

    expect(getActiveWorkspacePath()).toBe('/workspace');
    expect(runtime.getWorkspacePath()).toBe('/workspace');
    expect(runtime.perfMonitor).toBe(monitor);
    expect(runtime.noteRepository).toBeTruthy();
    expect(runtime.notebookRepository).toBeTruthy();
    expect(runtime.workspaceRepository).toBeTruthy();
    expect(runtime.indexRepository).toBeTruthy();
    expect(runtime.fileWatcher).toBeTruthy();
    expect(runtime.runNoteEffect).toBeTypeOf('function');
    expect(runtime.runSearchEffect).toBeTypeOf('function');
    expect(runtime.runMeetingEffect).toBeTypeOf('function');

    await expect(runtime.getDatabaseManager().getStatus()).resolves.toEqual({
      path: '',
      size: 0,
      isOpen: true,
    });
    await expect(runtime.getDatabaseManager().checkIntegrity()).resolves.toEqual({
      ok: true,
      errors: [],
    });
    await expect(runtime.getDatabaseManager().vacuum()).resolves.toBeUndefined();
    setActiveWorkspacePath(null);
  }, 15_000);

  it('delegates database manager calls when a manager is supplied', async () => {
    const { createApplicationRuntime } = await loadRuntimeModule();
    const dbManager = {
      getStatus: vi.fn().mockResolvedValue({ path: '/db.sqlite', size: 10, isOpen: true }),
      checkIntegrity: vi.fn().mockResolvedValue({ ok: false, errors: ['bad'] }),
      optimize: vi.fn().mockResolvedValue(undefined),
      getDbPath: vi.fn(() => '/db.sqlite'),
    };

    const runtime = createApplicationRuntime({
      db: {} as any,
      dbManager,
      perfMonitor: perfMonitor() as any,
    });

    await expect(runtime.getDatabaseManager().getStatus()).resolves.toEqual({
      path: '/db.sqlite',
      size: 10,
      isOpen: true,
    });
    await expect(runtime.getDatabaseManager().checkIntegrity()).resolves.toEqual({
      ok: false,
      errors: ['bad'],
    });
    await runtime.getDatabaseManager().vacuum();
    expect(dbManager.optimize).toHaveBeenCalledWith();
  });

  it('registers and unregisters IPC handlers for an explicit runtime', async () => {
    const {
      createApplicationRuntime,
      registerIPCHandlers,
      unregisterIPCHandlers,
    } = await loadRuntimeModule();
    const monitor = perfMonitor();

    const runtime = createApplicationRuntime({
      db: {} as any,
      perfMonitor: monitor as any,
    });
    registerIPCHandlers(runtime);
    expect(electronMock.handleSpy).toHaveBeenCalled();

    unregisterIPCHandlers();
    expect(electronMock.removeHandlerSpy).toHaveBeenCalled();

  });
});
