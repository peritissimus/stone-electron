/**
 * Lazy code-language loader for the TipTap CodeBlockWithMermaid extension.
 *
 * Languages are imported on demand to keep the initial bundle ~150KB smaller.
 * The preload list is now driven by EditorSettings.codeBlock.preloadLanguages
 * (config.json) — see preloadConfiguredLanguages.
 */

import { lowlight } from 'lowlight';
import { logger } from '@renderer/lib/logger';

const languageLoaders: Record<string, () => Promise<{ default: unknown }>> = {
  javascript: () => import('highlight.js/lib/languages/javascript'),
  js: () => import('highlight.js/lib/languages/javascript'),
  typescript: () => import('highlight.js/lib/languages/typescript'),
  ts: () => import('highlight.js/lib/languages/typescript'),
  python: () => import('highlight.js/lib/languages/python'),
  py: () => import('highlight.js/lib/languages/python'),
  java: () => import('highlight.js/lib/languages/java'),
  cpp: () => import('highlight.js/lib/languages/cpp'),
  'c++': () => import('highlight.js/lib/languages/cpp'),
  csharp: () => import('highlight.js/lib/languages/csharp'),
  cs: () => import('highlight.js/lib/languages/csharp'),
  go: () => import('highlight.js/lib/languages/go'),
  rust: () => import('highlight.js/lib/languages/rust'),
  rs: () => import('highlight.js/lib/languages/rust'),
  ruby: () => import('highlight.js/lib/languages/ruby'),
  rb: () => import('highlight.js/lib/languages/ruby'),
  php: () => import('highlight.js/lib/languages/php'),
  swift: () => import('highlight.js/lib/languages/swift'),
  kotlin: () => import('highlight.js/lib/languages/kotlin'),
  kt: () => import('highlight.js/lib/languages/kotlin'),
  sql: () => import('highlight.js/lib/languages/sql'),
  bash: () => import('highlight.js/lib/languages/bash'),
  sh: () => import('highlight.js/lib/languages/bash'),
  shell: () => import('highlight.js/lib/languages/bash'),
  json: () => import('highlight.js/lib/languages/json'),
  xml: () => import('highlight.js/lib/languages/xml'),
  html: () => import('highlight.js/lib/languages/xml'),
  css: () => import('highlight.js/lib/languages/css'),
  markdown: () => import('highlight.js/lib/languages/markdown'),
  md: () => import('highlight.js/lib/languages/markdown'),
};

const loadedLanguages = new Set<string>();

/**
 * Load a single language on demand. No-op if already loaded or unknown.
 */
export const loadLanguage = async (language: string): Promise<void> => {
  if (!language) return;
  const key = language.toLowerCase();
  if (loadedLanguages.has(key)) return;

  const loader = languageLoaders[key];
  if (!loader) return;

  try {
    const mod = await loader();
    lowlight.registerLanguage(key, mod.default as never);
    loadedLanguages.add(key);
  } catch (error) {
    logger.warn(`Failed to load language: ${language}`, error);
  }
};

/**
 * Pre-load the configured language list. Called once at editor mount with
 * EditorSettings.codeBlock.preloadLanguages.
 */
export const preloadConfiguredLanguages = async (languages: readonly string[]): Promise<void> => {
  await Promise.all(languages.map((lang) => loadLanguage(lang)));
};
