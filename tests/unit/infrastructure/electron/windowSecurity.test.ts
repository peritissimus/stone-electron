import { beforeEach, describe, expect, it, vi } from 'vitest';

const openExternal = vi.fn();

vi.mock('electron', () => ({
  shell: { openExternal },
}));

describe('windowSecurity', () => {
  beforeEach(() => {
    openExternal.mockReset();
  });

  it('denies window.open and sends https URLs to the system browser', async () => {
    const { hardenWindowNavigation } = await import(
      '../../../../src/main/infrastructure/electron/windowSecurity'
    );
    const setWindowOpenHandler = vi.fn();
    const on = vi.fn();
    const win = { webContents: { setWindowOpenHandler, on } } as any;

    hardenWindowNavigation(win, ['file://']);
    const handler = setWindowOpenHandler.mock.calls[0][0];

    expect(handler({ url: 'https://example.com' })).toEqual({ action: 'deny' });
    expect(openExternal).toHaveBeenCalledWith('https://example.com');
    expect(handler({ url: 'stone://internal' })).toEqual({ action: 'deny' });
  });

  it('allows configured origins and blocks foreign navigation', async () => {
    const { hardenWindowNavigation } = await import(
      '../../../../src/main/infrastructure/electron/windowSecurity'
    );
    const setWindowOpenHandler = vi.fn();
    const on = vi.fn();
    const win = { webContents: { setWindowOpenHandler, on } } as any;

    hardenWindowNavigation(win, ['file://', 'http://localhost:5173']);
    const willNavigate = on.mock.calls.find(([event]) => event === 'will-navigate')?.[1];

    const allowedEvent = { preventDefault: vi.fn() };
    willNavigate(allowedEvent, 'http://localhost:5173/#/today');
    expect(allowedEvent.preventDefault).not.toHaveBeenCalled();

    const blockedEvent = { preventDefault: vi.fn() };
    willNavigate(blockedEvent, 'https://example.com/phishing');
    expect(blockedEvent.preventDefault).toHaveBeenCalled();
    expect(openExternal).toHaveBeenCalledWith('https://example.com/phishing');
  });
});
