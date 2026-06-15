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

async function loadContainerModule() {
  vi.resetModules();
  return import('../../../../src/main/infrastructure/di/container');
}

describe('DI container', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    electronMock.ipcMain.handle = electronMock.handleSpy;
    electronMock.ipcMain.removeHandler = electronMock.removeHandlerSpy;
  });

  it('creates all public container slots and exposes workspace path helpers', async () => {
    const {
      createContainer,
      getActiveWorkspacePath,
      setActiveWorkspacePath,
      resetContainer,
    } = await loadContainerModule();
    const monitor = perfMonitor();

    resetContainer();
    setActiveWorkspacePath('/workspace');
    const container = createContainer({ db: {} as any, perfMonitor: monitor as any });

    expect(getActiveWorkspacePath()).toBe('/workspace');
    expect(container.getWorkspacePath()).toBe('/workspace');
    expect(container.perfMonitor).toBe(monitor);
    expect(container.noteRepository).toBeTruthy();
    expect(container.notebookRepository).toBeTruthy();
    expect(container.workspaceRepository).toBeTruthy();
    expect(container.indexRepository).toBeTruthy();
    expect(container.fileWatcher).toBeTruthy();
    expect(container.noteUseCases).toBeTruthy();
    expect(container.searchUseCases).toBeTruthy();
    expect(container.meetingUseCases).toBeTruthy();

    await expect(container.getDatabaseManager().getStatus()).resolves.toEqual({
      path: '',
      size: 0,
      isOpen: true,
    });
    await expect(container.getDatabaseManager().checkIntegrity()).resolves.toEqual({
      ok: true,
      errors: [],
    });
    await expect(container.getDatabaseManager().vacuum()).resolves.toBeUndefined();
  });

  it('delegates database manager calls when a manager is supplied', async () => {
    const { createContainer } = await loadContainerModule();
    const dbManager = {
      getStatus: vi.fn().mockResolvedValue({ path: '/db.sqlite', size: 10, isOpen: true }),
      checkIntegrity: vi.fn().mockResolvedValue({ ok: false, errors: ['bad'] }),
      optimize: vi.fn().mockResolvedValue(undefined),
      getDbPath: vi.fn(() => '/db.sqlite'),
    };

    const container = createContainer({
      db: {} as any,
      dbManager,
      perfMonitor: perfMonitor() as any,
    });

    await expect(container.getDatabaseManager().getStatus()).resolves.toEqual({
      path: '/db.sqlite',
      size: 10,
      isOpen: true,
    });
    await expect(container.getDatabaseManager().checkIntegrity()).resolves.toEqual({
      ok: false,
      errors: ['bad'],
    });
    await container.getDatabaseManager().vacuum();
    expect(dbManager.optimize).toHaveBeenCalledWith();
  });

  it('guards singleton lifecycle and registers/unregisters IPC handlers', async () => {
    const {
      getContainer,
      initializeContainer,
      registerIPCHandlers,
      resetContainer,
      unregisterIPCHandlers,
    } = await loadContainerModule();
    const monitor = perfMonitor();

    resetContainer();
    expect(() => getContainer()).toThrow('Container not initialized');

    const container = initializeContainer({ db: {} as any, perfMonitor: monitor as any });
    expect(getContainer()).toBe(container);
    expect(() => initializeContainer({ db: {} as any, perfMonitor: monitor as any })).toThrow(
      'Container already initialized',
    );

    registerIPCHandlers();
    expect(electronMock.handleSpy).toHaveBeenCalled();

    unregisterIPCHandlers();
    expect(electronMock.removeHandlerSpy).toHaveBeenCalled();

    resetContainer();
    expect(() => getContainer()).toThrow('Container not initialized');
  });
});
