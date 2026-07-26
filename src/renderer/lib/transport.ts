/**
 * Which shell the renderer is running inside.
 *
 * The same UI serves the Electron window and the browser, but a few affordances
 * only make sense in one of them: window chrome insets, in-app history buttons,
 * OS-level actions. Set by the web entry before React mounts, so it is stable
 * for the first render.
 */

declare global {
  interface Window {
    __stoneWebTransport?: boolean;
  }
}

export function markWebTransport(): void {
  window.__stoneWebTransport = true;
  // Exposed on the root element too, so stylesheets can drop the window-chrome
  // allowances without threading a prop through the layout.
  document.documentElement.dataset.stoneTransport = 'web';
}

/** True when served over HTTP to a browser rather than hosted by Electron. */
export function isWebTransport(): boolean {
  return window.__stoneWebTransport === true;
}
