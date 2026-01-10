/**
 * Application Settings Types
 */

/**
 * Font settings for the application
 * Supports separate fonts for UI, editor headings, editor body, and code
 */
export interface FontSettings {
  // UI elements (sidebar, menus, buttons)
  uiFont: string;
  uiFontSize: number;

  // Editor headings (h1-h6)
  editorHeadingFont: string;

  // Editor body text (paragraphs, lists, blockquotes)
  editorBodyFont: string;
  editorFontSize: number;
  editorLineHeight: number;

  // Code blocks and inline code
  monoFont: string;
  monoFontSize: number;
}

/**
 * Default font settings using system fonts
 * Platform-aware fallback stacks for maximum compatibility
 */
export const DEFAULT_FONT_SETTINGS: FontSettings = {
  // UI - Inter with system fallbacks
  uiFont:
    'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  uiFontSize: 13,

  // Editor headings - Barlow Semi Condensed
  editorHeadingFont:
    '"Barlow Semi Condensed", Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',

  // Editor body - Barlow
  editorBodyFont:
    'Barlow, Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  editorFontSize: 16,
  editorLineHeight: 1.65,

  // Code - Fira Code with fallbacks
  monoFont: '"Fira Code", "SF Mono", ui-monospace, Menlo, Monaco, monospace',
  monoFontSize: 14,
};

/**
 * System font options for each font category
 * These are curated lists of commonly available system fonts
 */
export const SYSTEM_FONT_OPTIONS = {
  ui: [
    {
      label: 'System Default',
      value:
        '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    },
    {
      label: 'SF Pro',
      value: '"SF Pro Display", "SF Pro Text", -apple-system, sans-serif',
    },
    {
      label: 'Segoe UI',
      value: '"Segoe UI", -apple-system, Roboto, sans-serif',
    },
    {
      label: 'Inter',
      value: 'Inter, -apple-system, sans-serif',
    },
  ],
  heading: [
    {
      label: 'System Default',
      value:
        '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    },
    {
      label: 'Georgia',
      value: 'Georgia, "Times New Roman", serif',
    },
    {
      label: 'Palatino',
      value: 'Palatino, "Palatino Linotype", "Book Antiqua", serif',
    },
    {
      label: 'Baskerville',
      value: 'Baskerville, "Baskerville Old Face", "Hoefler Text", Georgia, serif',
    },
    {
      label: 'Hoefler Text',
      value: '"Hoefler Text", Baskerville, Georgia, serif',
    },
  ],
  body: [
    {
      label: 'System Default',
      value:
        '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    },
    {
      label: 'Georgia',
      value: 'Georgia, "Times New Roman", serif',
    },
    {
      label: 'Charter',
      value: 'Charter, Georgia, serif',
    },
    {
      label: 'Iowan Old Style',
      value: '"Iowan Old Style", "Palatino Linotype", Georgia, serif',
    },
    {
      label: 'Seravek',
      value: 'Seravek, "Gill Sans Nova", "Trebuchet MS", sans-serif',
    },
  ],
  code: [
    {
      label: 'SF Mono',
      value: '"SF Mono", ui-monospace, Menlo, Monaco, monospace',
    },
    {
      label: 'Monaco',
      value: 'Monaco, "SF Mono", Menlo, monospace',
    },
    {
      label: 'Menlo',
      value: 'Menlo, Monaco, "Courier New", monospace',
    },
    {
      label: 'JetBrains Mono',
      value: '"JetBrains Mono", Menlo, Monaco, monospace',
    },
    {
      label: 'Cascadia Code',
      value: '"Cascadia Code", Consolas, Menlo, monospace',
    },
    {
      label: 'Consolas',
      value: 'Consolas, Monaco, "Courier New", monospace',
    },
  ],
};

/**
 * Complete application settings
 * Extends with other settings as needed (theme, etc.)
 */
export interface AppSettings {
  fonts: FontSettings;
  // Other settings can be added here (theme, etc.)
}
