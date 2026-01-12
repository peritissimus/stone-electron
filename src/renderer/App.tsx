/**
 * Stone - Main App Component
 */

import React, { useEffect, useState } from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import { Toaster } from 'sonner';
import { MainLayout } from '@renderer/components/composites';
import { QuickCaptureWindow } from '@renderer/components/features/QuickCapture';
import { useUIStore, ACCENT_COLORS } from '@renderer/stores/uiStore';

export const App: React.FC = () => {
  // Check if this is the quick capture window FIRST (before any store access)
  const [isQuickCapture] = useState(() => {
    const hash = window.location.hash;
    return hash === '#/quick-capture' || hash === '/quick-capture';
  });

  // Only access store for main window - quick capture doesn't need theme management
  const theme = useUIStore((state) => (isQuickCapture ? 'system' : state.theme));
  const accentColor = useUIStore((state) => (isQuickCapture ? 'blue' : state.accentColor));
  const fontSettings = useUIStore((state) =>
    isQuickCapture ? null : state.fontSettings,
  );

  // Apply theme (skip for quick capture - uses system default)
  useEffect(() => {
    if (isQuickCapture) {
      // Quick capture: just apply system theme immediately
      const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      document.documentElement.classList.toggle('dark', isDark);
      return;
    }

    const root = document.documentElement;

    if (theme === 'dark') {
      root.classList.add('dark');
      root.classList.remove('light');
    } else if (theme === 'light') {
      root.classList.remove('dark');
      root.classList.add('light');
    } else {
      // System preference
      root.classList.remove('light');
      const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      if (isDark) {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
      }
    }
  }, [theme, isQuickCapture]);

  // Apply accent color (skip for quick capture)
  useEffect(() => {
    if (isQuickCapture) return;

    const root = document.documentElement;
    const hue = ACCENT_COLORS[accentColor]?.hue ?? 211;
    const isDark = root.classList.contains('dark');

    if (isDark) {
      root.style.setProperty('--primary', `${hue} 100% 60%`);
      root.style.setProperty('--ring', `${hue} 100% 60%`);
      root.style.setProperty('--accent', `${hue} 80% 40% / 0.6`);
      root.style.setProperty('--accent-foreground', `${hue} 100% 75%`);
    } else {
      root.style.setProperty('--primary', `${hue} 100% 50%`);
      root.style.setProperty('--ring', `${hue} 100% 50%`);
      root.style.setProperty('--accent', `${hue} 100% 90% / 0.6`);
      root.style.setProperty('--accent-foreground', `${hue} 100% 40%`);
    }
  }, [accentColor, theme, isQuickCapture]);

  // Apply font settings as CSS variables (skip for quick capture)
  useEffect(() => {
    if (isQuickCapture || !fontSettings) return;

    const root = document.documentElement;

    // UI fonts
    root.style.setProperty('--font-ui', fontSettings.uiFont);
    root.style.setProperty('--font-ui-size', `${fontSettings.uiFontSize}px`);

    // Editor fonts
    root.style.setProperty('--font-editor-heading', fontSettings.editorHeadingFont);
    root.style.setProperty('--font-editor-body', fontSettings.editorBodyFont);
    root.style.setProperty('--font-editor-size', `${fontSettings.editorFontSize}px`);
    root.style.setProperty('--font-editor-line-height', fontSettings.editorLineHeight.toString());

    // Code fonts
    root.style.setProperty('--font-mono', fontSettings.monoFont);
    root.style.setProperty('--font-mono-size', `${fontSettings.monoFontSize}px`);
  }, [fontSettings, isQuickCapture]);

  // Render quick capture window if that's the route (minimal UI, no toaster)
  if (isQuickCapture) {
    return <QuickCaptureWindow />;
  }

  return (
    <HashRouter>
      <Routes>
        {/* All routes render within MainLayout */}
        <Route path="/*" element={<MainLayout />} />
      </Routes>
      <Toaster position="top-center" richColors closeButton />
    </HashRouter>
  );
};
