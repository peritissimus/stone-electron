/**
 * Workbench overlay stack — command center, modals, and docks.
 * All lazy-loaded to keep the persistent shell lean.
 */

import { lazy, Suspense } from 'react';
import type { RichTextEditor } from '@renderer/features/notes/editor';

// Lazy load overlay components
const CommandCenter = lazy(() =>
  import('@renderer/features/command-center/views/components/CommandCenter').then((m) => ({
    default: m.CommandCenter,
  })),
);
const FindReplaceModal = lazy(() =>
  import('@renderer/features/notes/views/editor/FindReplaceModal').then((m) => ({
    default: m.FindReplaceModal,
  })),
);
const AskNotesPanel = lazy(() =>
  import('@renderer/features/ai/views/components').then((m) => ({
    default: m.AskNotesPanel,
  })),
);
const RecordingDock = lazy(() =>
  import('@renderer/features/meetings/views/components').then((m) => ({
    default: m.RecordingDock,
  })),
);
const TemplatePickerDialog = lazy(() =>
  import('@renderer/features/templates/views/components').then((m) => ({
    default: m.TemplatePickerDialog,
  })),
);
const VoiceCaptureDock = lazy(() =>
  import('@renderer/features/voice-capture/views/components').then((m) => ({
    default: m.VoiceCaptureDock,
  })),
);

export interface WorkbenchOverlaysProps {
  /** Active rich-text editor instance, for FindReplaceModal. */
  editor: RichTextEditor | null;
}

export function WorkbenchOverlays({ editor }: WorkbenchOverlaysProps) {
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
