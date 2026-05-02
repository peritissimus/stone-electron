/**
 * Renderer Performance Monitoring
 *
 * Tracks FPS, long tasks, and other renderer-side performance metrics.
 * Exposes data to window.__STONE_PERF__ for main process to read.
 */

interface LongTaskEntry {
  name: string;
  startTime: number;
  duration: number;
}

interface RendererPerformanceData {
  fps: number | null;
  longTasks: LongTaskEntry[];
  lastFrameTime: number;
  frameCount: number;
}

// Global performance data exposed to main process
declare global {
  interface Window {
    __STONE_PERF__?: RendererPerformanceData;
  }
}

let isMonitoring = false;
let rafId: number | null = null;
let longTaskObserver: PerformanceObserver | null = null;

const MAX_LONG_TASKS = 100;

// Initialize the global performance object
function initPerfData(): RendererPerformanceData {
  if (!window.__STONE_PERF__) {
    window.__STONE_PERF__ = {
      fps: null,
      longTasks: [],
      lastFrameTime: performance.now(),
      frameCount: 0,
    };
  }
  return window.__STONE_PERF__;
}

/**
 * FPS Tracking using requestAnimationFrame
 */
function trackFPS(): void {
  const data = initPerfData();
  const now = performance.now();
  const elapsed = now - data.lastFrameTime;

  data.frameCount++;

  // Update FPS every second
  if (elapsed >= 1000) {
    data.fps = Math.round((data.frameCount * 1000) / elapsed);
    data.frameCount = 0;
    data.lastFrameTime = now;
  }

  if (isMonitoring) {
    rafId = requestAnimationFrame(trackFPS);
  }
}

/**
 * Long Task Tracking using PerformanceObserver
 * Long tasks are tasks that take > 50ms and block the main thread
 */
function startLongTaskTracking(): void {
  if (longTaskObserver) return;

  try {
    longTaskObserver = new PerformanceObserver((list) => {
      const data = initPerfData();
      const entries = list.getEntries();

      for (const entry of entries) {
        data.longTasks.push({
          name: entry.name,
          startTime: entry.startTime,
          duration: entry.duration,
        });

        // Keep only last N entries
        if (data.longTasks.length > MAX_LONG_TASKS) {
          data.longTasks = data.longTasks.slice(-MAX_LONG_TASKS);
        }
      }
    });

    longTaskObserver.observe({ entryTypes: ['longtask'] });
  } catch {
    // Long task observation not supported
    console.debug('[Perf] Long task observation not supported');
  }
}

/**
 * Start renderer performance monitoring
 */
export function startRendererMonitoring(): void {
  if (isMonitoring) return;

  isMonitoring = true;
  const data = initPerfData();

  // Start FPS tracking
  data.lastFrameTime = performance.now();
  data.frameCount = 0;
  rafId = requestAnimationFrame(trackFPS);

  // Start long task tracking
  startLongTaskTracking();

  console.debug('[Perf] Renderer monitoring started');
}

/**
 * Stop renderer performance monitoring
 */
export function stopRendererMonitoring(): void {
  isMonitoring = false;

  if (rafId !== null) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }

  if (longTaskObserver) {
    longTaskObserver.disconnect();
    longTaskObserver = null;
  }

  console.debug('[Perf] Renderer monitoring stopped');
}

/**
 * Get current renderer performance data
 */
export function getRendererPerformance(): RendererPerformanceData {
  return initPerfData();
}

/**
 * Clear long task history
 */
export function clearLongTasks(): void {
  const data = initPerfData();
  data.longTasks = [];
}

/**
 * Get Web Vitals metrics if available
 */
export function getWebVitals(): Record<string, number> {
  const vitals: Record<string, number> = {};

  try {
    const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    if (navigation) {
      // Time to First Byte
      vitals.ttfb = navigation.responseStart - navigation.fetchStart;

      // DOM Content Loaded
      vitals.dcl = navigation.domContentLoadedEventEnd - navigation.fetchStart;

      // Load Complete
      vitals.load = navigation.loadEventEnd - navigation.fetchStart;

      // DOM Interactive
      vitals.domInteractive = navigation.domInteractive - navigation.fetchStart;
    }

    // First Contentful Paint
    const fcp = performance.getEntriesByName('first-contentful-paint')[0];
    if (fcp) {
      vitals.fcp = fcp.startTime;
    }

    // Largest Contentful Paint (if available)
    const lcpEntries = performance.getEntriesByType('largest-contentful-paint');
    if (lcpEntries.length > 0) {
      vitals.lcp = lcpEntries[lcpEntries.length - 1].startTime;
    }
  } catch {
    // Performance API not fully supported
  }

  return vitals;
}

/**
 * Measure a synchronous operation
 */
export function measureSync<T>(name: string, fn: () => T): T {
  const start = performance.now();
  try {
    return fn();
  } finally {
    const duration = performance.now() - start;
    if (duration > 16) {
      // Longer than one frame (60fps = 16.67ms)
      console.debug(`[Perf] ${name} took ${duration.toFixed(2)}ms`);
    }
  }
}

/**
 * Measure an async operation
 */
export async function measureAsync<T>(name: string, fn: () => Promise<T>): Promise<T> {
  const start = performance.now();
  try {
    return await fn();
  } finally {
    const duration = performance.now() - start;
    if (duration > 100) {
      console.debug(`[Perf] ${name} took ${duration.toFixed(2)}ms`);
    }
  }
}

// Auto-start monitoring when module loads (can be disabled)
if (typeof window !== 'undefined') {
  initPerfData();
}
