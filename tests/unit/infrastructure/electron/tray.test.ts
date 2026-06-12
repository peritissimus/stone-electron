import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EVENTS } from '../../../../src/shared/constants/ipcChannels';

const electronMock = vi.hoisted(() => {
  const trayInstances: any[] = [];
  const resizedImage = {
    setTemplateImage: vi.fn(),
  };
  const image = {
    isEmpty: vi.fn(() => false),
    resize: vi.fn(() => resizedImage),
  };
  const Tray = vi.fn(function MockTray(this: any, icon: unknown) {
    this.icon = icon;
    this.handlers = {};
    this.destroy = vi.fn();
    this.on = vi.fn((event: string, callback: () => void) => {
      this.handlers[event] = callback;
    });
    this.popUpContextMenu = vi.fn();
    this.setContextMenu = vi.fn();
    this.setTitle = vi.fn();
    this.setToolTip = vi.fn();
    trayInstances.push(this);
  });
  return {
    trayInstances,
    image,
    resizedImage,
    app: { getAppPath: vi.fn(() => '/app') },
    nativeImage: { createFromPath: vi.fn(() => image) },
    Menu: { buildFromTemplate: vi.fn((items: unknown[]) => ({ items })) },
    Tray,
  };
});

vi.mock('electron', () => ({
  app: electronMock.app,
  Menu: electronMock.Menu,
  nativeImage: electronMock.nativeImage,
  Tray: electronMock.Tray,
}));

function setPlatform(platform: NodeJS.Platform) {
  Object.defineProperty(process, 'platform', { value: platform, configurable: true });
}

async function loadTrayModule(platform: NodeJS.Platform = 'darwin') {
  vi.resetModules();
  setPlatform(platform);
  Object.defineProperty(process, 'resourcesPath', { value: '/resources', configurable: true });
  return import('../../../../src/main/infrastructure/electron/tray');
}

describe('tray', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    electronMock.trayInstances.length = 0;
    electronMock.image.isEmpty.mockReturnValue(false);
    electronMock.nativeImage.createFromPath.mockReturnValue(electronMock.image);
  });

  it('creates a macOS tray from icon.png as a normal raster icon, not a template mask', async () => {
    const { createTray, destroyTray } = await loadTrayModule('darwin');

    createTray({ getMainWindow: () => null });

    expect(electronMock.nativeImage.createFromPath).toHaveBeenCalledWith('/resources/icon.png');
    expect(electronMock.image.resize).toHaveBeenCalledWith({
      width: 18,
      height: 18,
      quality: 'best',
    });
    expect(electronMock.resizedImage.setTemplateImage).toHaveBeenCalledWith(false);
    expect(electronMock.Tray).toHaveBeenCalledWith(electronMock.resizedImage);
    expect(electronMock.trayInstances[0].setToolTip).toHaveBeenCalledWith('Stone');

    destroyTray();
    expect(electronMock.trayInstances[0].destroy).toHaveBeenCalledWith();
  });

  it('falls back to the app path icon and uses a 16px non-macOS tray asset', async () => {
    const { createTray } = await loadTrayModule('linux');
    electronMock.nativeImage.createFromPath
      .mockReturnValueOnce({ isEmpty: () => true } as any)
      .mockReturnValueOnce(electronMock.image);

    createTray({ getMainWindow: () => null });

    expect(electronMock.nativeImage.createFromPath).toHaveBeenNthCalledWith(1, '/resources/icon.png');
    expect(electronMock.nativeImage.createFromPath).toHaveBeenNthCalledWith(2, '/app/build/icon.png');
    expect(electronMock.image.resize).toHaveBeenCalledWith({
      width: 16,
      height: 16,
      quality: 'best',
    });
    expect(electronMock.resizedImage.setTemplateImage).not.toHaveBeenCalled();
  });

  it('updates recording state, sends menu commands to the renderer, and restores the window', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-21T10:00:00Z'));
    const { createTray, destroyTray, updateTrayState } = await loadTrayModule('darwin');
    const window = {
      isDestroyed: () => false,
      isMinimized: () => true,
      restore: vi.fn(),
      show: vi.fn(),
      focus: vi.fn(),
      webContents: { send: vi.fn() },
    };

    createTray({ getMainWindow: () => window as any });
    updateTrayState({ phase: 'recording' });
    vi.setSystemTime(new Date('2026-04-21T10:00:42Z'));
    vi.advanceTimersByTime(1000);

    const tray = electronMock.trayInstances[0];
    const latestMenu = electronMock.Menu.buildFromTemplate.mock.results.at(-1)?.value as {
      items: Array<{ label?: string; click?: () => void }>;
    };
    latestMenu.items.find((item) => item.label === 'Stop and process')?.click?.();

    expect(tray.setTitle).toHaveBeenLastCalledWith(' ● 00:43');
    expect(window.restore).toHaveBeenCalledWith();
    expect(window.show).toHaveBeenCalledWith();
    expect(window.focus).toHaveBeenCalledWith();
    expect(window.webContents.send).toHaveBeenCalledWith(EVENTS.MEETING_STOP_REQUESTED);

    updateTrayState({ phase: 'finalizing' });
    expect(tray.setTitle).toHaveBeenLastCalledWith(' ⟳');
    expect(tray.setToolTip).toHaveBeenLastCalledWith('Stone — transcribing and summarising');

    destroyTray();
    vi.useRealTimers();
  });

  it('skips tray creation when all icon candidates are empty', async () => {
    const { createTray } = await loadTrayModule('darwin');
    electronMock.image.isEmpty.mockReturnValue(true);

    createTray({ getMainWindow: () => null });

    expect(electronMock.Tray).not.toHaveBeenCalled();
  });
});
