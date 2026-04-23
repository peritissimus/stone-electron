import { test, expect } from './fixtures/electron';

// Regression guard for the QuickCapture → open-journal refresh chain.
// The bug: AppendToJournalUseCase wrote the file without emitting
// NOTE_UPDATED, so an already-open journal stayed stale until the user
// re-opened it. This test drives the IPC directly from the renderer and
// asserts the ProseMirror editor reflects the appended line — which
// exercises: IPC → use case → file write → NOTE_UPDATED publish → preload
// bridge → useDocumentBuffer subscribe → reloadFromFile → setContent.
test('appendToJournal refreshes the open journal in place', async ({ app }) => {
  const window = await app.firstWindow();

  // Today's journal auto-opens on startup, so the ProseMirror editor is
  // already bound to today's note when it appears.
  await expect(window.locator('.ProseMirror')).toBeVisible({ timeout: 15_000 });

  // Unique token per-run so assertions can't accidentally pass against
  // stale content from a previous iteration in the same userDataDir.
  const marker = `e2e-qc-${Date.now()}`;

  const result = await window.evaluate(
    async (text) =>
      // @ts-expect-error - contextBridge-exposed API is untyped on `window`
      await window.electron.invoke('quickCapture:appendToJournal', { text }),
    marker,
  );

  expect(result).toMatchObject({ success: true });

  // reloadFromFile has a 100ms debounce after NOTE_UPDATED; 10s is ample.
  await expect(window.locator('.ProseMirror')).toContainText(marker, { timeout: 10_000 });
});
