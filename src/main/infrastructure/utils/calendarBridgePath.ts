import { app } from 'electron';
import path from 'node:path';

export function calendarBridgePath(): string {
  const appPath = typeof app.getAppPath === 'function' ? app.getAppPath() : process.cwd();
  return app.isPackaged
    ? path.join(process.resourcesPath, 'calendar', 'StoneCalendarBridge')
    : path.join(appPath, 'dist', 'native', 'StoneCalendarBridge');
}
