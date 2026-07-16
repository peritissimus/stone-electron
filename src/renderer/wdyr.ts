/**
 * Development profiling tools
 *
 * why-did-you-render: Enable with VITE_WDYR=1 pnpm dev
 */

import React from 'react';

// why-did-you-render for detecting unnecessary re-renders
if (import.meta.env.DEV && import.meta.env.VITE_WDYR) {
  const whyDidYouRender = await import('@welldone-software/why-did-you-render');
  const { logger } = await import('@renderer/services/telemetry/logger');
  whyDidYouRender.default(React, {
    trackAllPureComponents: true,
    trackHooks: true,
    logOnDifferentValues: true,
  });
  logger.info('[WDYR] why-did-you-render enabled');
}
