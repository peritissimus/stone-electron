/**
 * System IPC Handlers
 * Handle system-level operations like getting available fonts
 */


import { getFonts } from 'font-list';
import { SYSTEM_CHANNELS } from '@shared/constants/ipcChannels';
import { registerHandler } from '../utils';
import { logger } from '../../utils/logger';

/**
 * Get all system fonts
 * Returns unique font families available on the system
 */
async function getSystemFonts(): Promise<string[]> {
  try {
    const fonts = await getFonts();
    return fonts.sort();
  } catch (error) {
    logger.error('[System] Failed to get system fonts:', error);
    // Return a fallback list of common fonts
    return [
      'Arial',
      'Georgia',
      'Helvetica',
      'Monaco',
      'Times New Roman',
      'Courier New',
    ];
  }
}

/**
 * Register all system handlers
 */
export function registerSystemHandlers() {
  // system:getFonts
  registerHandler(
    SYSTEM_CHANNELS.GET_FONTS,
    async () => {
      const fonts = await getSystemFonts();
      return fonts;
    }
  );

  logger.info('[IPC] System handlers registered');
}
