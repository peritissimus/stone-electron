import { markWebTransport } from '@renderer/lib/transport';
import { installWebElectronBridge } from './webElectronBridge';

// Must run before the app module loads so the first render already knows it is
// in a browser and can drop the Electron-only window chrome.
markWebTransport();
installWebElectronBridge();
await import('../main');
