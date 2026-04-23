/**
 * Round-trip helper: writes a markdown file to a temp path, opens it in
 * Stone's scratch editor via the same IPC bridge "Open With" uses,
 * appends a unique marker to force the dirty flag + a save, then reads
 * the file back and returns what landed on disk. Callers get a clean
 * "markdown in → saved markdown out" surface to assert against.
 *
 * Each round trip uses its own tmpdir + unique filename so multiple
 * features can be exercised within a single test without stepping on
 * each other's files.
 */

import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { ElectronApplication, Page, Locator } from '@playwright/test';
import { expect } from '@playwright/test';

export interface RoundTripResult {
  saved: string;
  marker: string;
  cleanup: () => void;
}

export async function roundTripMarkdown(
  app: ElectronApplication,
  window: Page,
  editor: Locator,
  initial: string,
  options: { name?: string } = {},
): Promise<RoundTripResult> {
  // Each case gets a unique filename so the ScratchEditor header's filename
  // span changes across iterations — that span is our "new file loaded"
  // synchronization signal, robust across different initial-content shapes
  // (headings vs links vs fences that would otherwise complicate text-based
  // sync against the rendered editor).
  const slug = (options.name ?? 'case').replace(/[^\w]+/g, '-');
  const scratchDir = mkdtempSync(join(tmpdir(), `stone-rt-${slug}-`));
  const fileBasename = `${slug}-${Date.now()}.md`;
  const filePath = join(scratchDir, fileBasename);
  // Append a sentinel plain paragraph at end of content. This gives our
  // execCommand-based caret-at-end-of-doc trick a safe, guaranteed-plain
  // place to land — without it, when the final block is a code fence or
  // another non-paragraph node, the caret lands somewhere unexpected and
  // `insertText` silently no-ops.
  const normalized = initial.endsWith('\n') ? initial : `${initial}\n`;
  const withSentinel = `${normalized}\nscratch-test-tail-paragraph\n`;
  writeFileSync(filePath, withSentinel, 'utf-8');

  const cleanup = () => rmSync(scratchDir, { recursive: true, force: true });

  // Drive the "Open With" seam: main → SCRATCH_OPEN_PATH → renderer → /scratch.
  await app.evaluate(({ BrowserWindow }, path) => {
    const win = BrowserWindow.getAllWindows()[0];
    win?.webContents.send('scratch:openPath', path);
  }, filePath);

  // Wait for the scratch editor's header to show this specific filename.
  // Using `.first()` defends against any stale matching header during
  // route transitions.
  await expect(window.getByText(fileBasename, { exact: true }).first()).toBeVisible({
    timeout: 10_000,
  });
  await expect(editor).toBeVisible({ timeout: 5_000 });

  // Force a save by appending a unique marker paragraph. Using Selection
  // API + execCommand is the most reliable way to place the caret at
  // end-of-doc in Electron's ProseMirror surface.
  const marker = `marker-${options.name ?? 'x'}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  await window.evaluate((text) => {
    const pmDom = document.querySelector('.ProseMirror') as HTMLElement | null;
    if (!pmDom) throw new Error('ProseMirror not found');
    pmDom.focus();
    const range = document.createRange();
    range.selectNodeContents(pmDom);
    range.collapse(false);
    // Use document.getSelection() — TypeScript resolves the outer-scope
    // `window` to Playwright's Page and rejects `window.getSelection()`,
    // but document.getSelection() is DOM-typed and runs the same thing.
    const sel = document.getSelection();
    if (!sel) throw new Error('No selection');
    sel.removeAllRanges();
    sel.addRange(range);
    document.execCommand('insertParagraph');
    document.execCommand('insertText', false, text);
  }, marker);

  await expect(editor).toContainText(marker, { timeout: 5_000 });

  // Save button encodes `!isDirty || status !== 'ready'`. Waiting on its
  // enabled/disabled state is a more reliable sync than the "Unsaved
  // changes" label, which races between cases when React commits the
  // new isDirty state before re-rendering the label.
  const saveButton = window.getByRole('button', { name: 'Save' });
  await expect(saveButton).toBeEnabled({ timeout: 5_000 });
  await saveButton.click();
  await expect(saveButton).toBeDisabled({ timeout: 5_000 });

  const saved = readFileSync(filePath, 'utf-8');
  return { saved, marker, cleanup };
}
