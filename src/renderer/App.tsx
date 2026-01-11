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
  const theme = useUIStore((state) => state.theme);
  const accentColor = useUIStore((state) => state.accentColor);
  const fontSettings = useUIStore((state) => state.fontSettings);

  // Check if this is the quick capture window (check before router takes over)
  const [isQuickCapture] = useState(() => {
    const hash = window.location.hash;
    return hash === '#/quick-capture' || hash === '/quick-capture';
  });

  // Apply theme
  useEffect(() => {
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
  }, [theme]);

  // Apply accent color
  useEffect(() => {
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
  }, [accentColor, theme]);

  // Apply font settings as CSS variables
  useEffect(() => {
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
  }, [fontSettings]);

  // Render quick capture window if that's the route
  if (isQuickCapture) {
    return (
      <>
        <QuickCaptureWindow />
        <Toaster position="top-center" richColors closeButton />
      </>
    );
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
