import { afterEach, describe, expect, it, vi } from 'vitest';
const { app, fs } = vi.hoisted(() => ({
  app: { commandLine: { getSwitchValue: vi.fn() }, getPath: vi.fn(), setPath: vi.fn() },
  fs: { mkdirSync: vi.fn(), existsSync: vi.fn(), cpSync: vi.fn() },
}));
vi.mock('electron', () => ({ app }));
vi.mock('node:fs', () => ({ default: fs }));
import { relocateUserData } from '../../../../src/main/infrastructure/electron/appPaths';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe('E2E user data isolation', () => {
  it('honors the explicit temporary directory without migrating real user data', () => {
    vi.stubEnv('E2E_TEST', 'true');
    app.commandLine.getSwitchValue.mockReturnValue('/tmp/stone-test-profile');
    expect(relocateUserData()).toBe('/tmp/stone-test-profile');
    expect(app.setPath).toHaveBeenCalledWith('userData', '/tmp/stone-test-profile');
    expect(fs.cpSync).not.toHaveBeenCalled();
    expect(app.getPath).not.toHaveBeenCalled();
  });
  it.each(['', 'relative/path'])('refuses an unsafe E2E directory: %s', (value) => {
    vi.stubEnv('E2E_TEST', 'true');
    app.commandLine.getSwitchValue.mockReturnValue(value);
    expect(relocateUserData).toThrow('absolute --user-data-dir');
    expect(app.setPath).not.toHaveBeenCalled();
  });
});
