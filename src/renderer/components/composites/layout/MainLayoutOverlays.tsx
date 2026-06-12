/**
 * MainLayout overlay stack — command center, modals, and docks.
 * All lazy-loaded; split out of MainLayout to keep the shell lean.
 */

import { lazy, Suspense } from 'react';
import type { RichTextEditor } from '@renderer/editor';

// Lazy load overlay components
const CommandCenter = lazy(() =>
  import('@renderer/components/features/CommandCenter/CommandCenter').then((m) => ({
    default: m.CommandCenter,
  })),
);
const FindReplaceModal = lazy(() =>
  import('@renderer/components/features/FindReplace/FindReplaceModal').then((m) => ({
    default: m.FindReplaceModal,
  })),
);
const AskNotesPanel = lazy(() =>
  import('@renderer/components/features/AI').then((m) => ({
    default: m.AskNotesPanel,
  })),
);
const RecordingDock = lazy(() =>
  import('@renderer/components/features/Meeting').then((m) => ({
    default: m.RecordingDock,
  })),
);
const TemplatePickerDialog = lazy(() =>
  import('@renderer/components/features/Templates').then((m) => ({
    default: m.TemplatePickerDialog,
  })),
);
const VoiceCaptureDock = lazy(() =>
  import('@renderer/components/features/VoiceCapture').then((m) => ({
    default: m.VoiceCaptureDock,
  })),
);

export interface MainLayoutOverlaysProps {
  /** Active rich-text editor instance, for FindReplaceModal. */
  editor: RichTextEditor | null;
}

export function MainLayoutOverlays({ editor }: MainLayoutOverlaysProps) {
  return (
    <>
      <Suspense fallback={null}>
        <CommandCenter />
      </Suspense>
      <Suspense fallback={null}>
        <FindReplaceModal editor={editor} />
      </Suspense>
      <Suspense fallback={null}>
        <AskNotesPanel />
      </Suspense>
      <Suspense fallback={null}>
        <RecordingDock />
      </Suspense>
      <Suspense fallback={null}>
        <TemplatePickerDialog />
      </Suspense>
      <Suspense fallback={null}>
        <VoiceCaptureDock />
      </Suspense>
    </>
  );
}
