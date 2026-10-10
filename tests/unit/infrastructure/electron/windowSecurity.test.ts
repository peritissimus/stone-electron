import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { BrowserWindow, WebContents } from 'electron';

const { openExternal } = vi.hoisted(() => ({ openExternal: vi.fn().mockResolvedValue(undefined) }));
vi.mock('electron', () => ({ shell: { openExternal } }));

import {
  hardenWindowNavigation,
  isAllowedRendererUrl,
  isTrustedRenderer,
} from '../../../../src/main/infrastructure/electron/windowSecurity';

const appUrl =
  'file:///Applications/Stone.app/Contents/Resources/app.asar/dist/renderer/index.html';

function windowFixture() {
  const contents = {
    mainFrame: { url: appUrl },
    isDestroyed: vi.fn().mockReturnValue(false),
    setWindowOpenHandler: vi.fn(),
    on: vi.fn(),
  };
  const sender = contents as unknown as WebContents;
  hardenWindowNavigation({ webContents: sender } as BrowserWindow, [appUrl]);
  const fire = (name: string, url: string, isMainFrame = true) => {
    const event = { url, isMainFrame, preventDefault: vi.fn() };
    const handler = contents.on.mock.calls.find(([eventName]) => eventName === name)?.[1];
    handler(event);
    return event;
  };
  return { contents, sender, fire };
}

describe('windowSecurity', () => {
  beforeEach(() => openExternal.mockClear());

  it('allows renderer hash routes, but not other files or extra queries', () => {
    expect(isAllowedRendererUrl(`${appUrl}#/today`, [appUrl])).toBe(true);
    for (const url of [
      'file:///tmp/untrusted.html',
      `${appUrl}.evil.html`,
      `${appUrl}?extra=1`,
      'data:text/html,hello',
      'about:blank',
      'not a URL',
    ])
      expect(isAllowedRendererUrl(url, [appUrl])).toBe(false);
  });

  it('compares dev origins, rejecting credentials and prefix lookalikes', () => {
    const allowed = ['http://localhost:5173'];
    expect(isAllowedRendererUrl('http://localhost:5173/#/today', allowed)).toBe(true);
    for (const url of [
      'http://localhost:51730/',
      'http://localhost:5173@evil.example/',
      'http://evil.example:5173/',
      'http://user:password@localhost:5173/',
      'blob:http://localhost:5173/untrusted-document',
      appUrl,
    ])
      expect(isAllowedRendererUrl(url, allowed)).toBe(false);
  });

  it('denies windows, redirects, subframes, and webviews without opening redirects externally', () => {
    const { contents, fire } = windowFixture();
    const open = contents.setWindowOpenHandler.mock.calls[0][0];
    expect(open({ url: 'https://example.com/' })).toEqual({ action: 'deny' });
    expect(openExternal).toHaveBeenCalledWith('https://example.com/');
    openExternal.mockClear();
    expect(open({ url: 'javascript:alert(1)' })).toEqual({ action: 'deny' });
    expect(fire('will-navigate', appUrl).preventDefault).not.toHaveBeenCalled();
    expect(fire('will-navigate', 'file:///tmp/untrusted.html').preventDefault).toHaveBeenCalled();
    expect(fire('will-frame-navigate', appUrl, false).preventDefault).toHaveBeenCalled();
    expect(fire('will-redirect', 'https://example.com/').preventDefault).toHaveBeenCalled();
    expect(fire('will-attach-webview', '').preventDefault).toHaveBeenCalled();
    expect(openExternal).not.toHaveBeenCalled();
    expect(fire('will-navigate', 'https://example.com/').preventDefault).toHaveBeenCalled();
    expect(openExternal).toHaveBeenCalledWith('https://example.com/');
  });

  it('trusts only a registered live window main frame at its approved URL', () => {
    const { contents, sender } = windowFixture();
    const trusted = { sender, senderFrame: sender.mainFrame };
    expect(isTrustedRenderer(trusted)).toBe(true);
    expect(isTrustedRenderer({ sender, senderFrame: null })).toBe(false);
    expect(
      isTrustedRenderer({ sender, senderFrame: { url: appUrl } as typeof sender.mainFrame }),
    ).toBe(false);
    contents.mainFrame.url = 'file:///tmp/untrusted.html';
    expect(isTrustedRenderer(trusted)).toBe(false);
    contents.mainFrame.url = appUrl;
    contents.isDestroyed.mockReturnValue(true);
    expect(isTrustedRenderer(trusted)).toBe(false);
    expect(isTrustedRenderer({ sender: {} as WebContents, senderFrame: null })).toBe(false);
  });
});
