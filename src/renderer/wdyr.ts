/**
 * Development profiling tools
 *
 * React DevTools: Run `pnpm react-devtools` in a separate terminal FIRST,
 *                 then start the app with `pnpm dev`
 *
 * why-did-you-render: Enable with VITE_WDYR=1 pnpm dev
 */

import React from 'react';

// why-did-you-render for detecting unnecessary re-renders
if (import.meta.env.DEV && import.meta.env.VITE_WDYR) {
  const whyDidYouRender = await import('@welldone-software/why-did-you-render');
  const { logger } = await import('@renderer/utils/logger');
  whyDidYouRender.default(React, {
    trackAllPureComponents: true,
    trackHooks: true,
    logOnDifferentValues: true,
  });
  logger.info('[WDYR] why-did-you-render enabled');
}
