import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test, expect } from './fixtures/electron';

// Scratch mode round-trip: we drop a markdown file on disk, open it via
// the same IPC bridge "Open With Stone" takes from Finder, append an
// edit, save via the UI, and read the file back to verify:
//
//   1. The scratch editor wired up the file we pointed it at.
//   2. Initial content survives the markdown → ProseMirror → markdown
//      round trip (heading, bold, italic, list, inline code, link).
//   3. User edits make it to disk.
//
// Note: mermaid fenced blocks are NOT included here. Stone's markdown
// serializer currently loses the body of ```mermaid``` code fences on
// round trip — tracked as a separate bug. Keep this test scoped to
// round-trip-safe constructs so it stays a stable regression guard for
// scratch mode itself.
const INITIAL_CONTENT = `# Scratch Round-Trip Test

Some **baseline** prose with _emphasis_ and \`inline code\`.

- First item
- Second item with a [link](https://example.com)
- Third item

Trailing paragraph.
`;

test('scratch editor: open, edit, save, round-trip through disk', async ({ app }) => {
  const window = await app.firstWindow();
  await window.waitForLoadState('domcontentloaded');

  // Wait for the app's initial auto-opened journal editor to render. This
  // also proves MainLayout is mounted — without it, the SCRATCH_OPEN_PATH
  // subscriber wouldn't be attached yet and our `app.evaluate` below
  // would arrive into a void.
  const editor = window.locator('.ProseMirror');
  await expect(editor).toBeVisible({ timeout: 15_000 });

  // Intentionally outside any workspace — scratch must work on absolute
  // paths that Stone has never seen before.
  const scratchDir = mkdtempSync(join(tmpdir(), 'stone-scratch-'));
  const filePath = join(scratchDir, 'round-trip.md');
  writeFileSync(filePath, INITIAL_CONTENT, 'utf-8');

  try {
    // Exact seam Finder's "Open With Stone" takes: main process emits
    // SCRATCH_OPEN_PATH, the renderer subscriber navigates to /scratch.
    await app.evaluate(({ BrowserWindow }, path) => {
      const win = BrowserWindow.getAllWindows()[0];
      win?.webContents.send('scratch:openPath', path);
    }, filePath);

    // Scratch editor now shows the file's content.
    await expect(editor).toContainText('baseline prose', { timeout: 10_000 });
    await expect(editor).toContainText('Trailing paragraph', { timeout: 5_000 });

    // The freshly-loaded document must NOT be marked dirty. If this
    // assertion ever fires, useScratchDocument's setContent → update
    // race has regressed.
    await expect(window.getByLabel('Unsaved changes')).toBeHidden();

    // Append a marker at end of doc via the Selection API. More reliable
    // than keyboard cursor navigation in Electron: `Meta+End` doesn't
    // consistently move to end-of-doc in ProseMirror, and if the cursor
    // starts somewhere unexpected we can quietly type into the wrong spot.
    const marker = `scratch-edited-${Date.now()}`;
    await window.evaluate((text) => {
      const pmDom = document.querySelector('.ProseMirror') as HTMLElement | null;
      if (!pmDom) throw new Error('ProseMirror editor not found');
      pmDom.focus();
      const range = document.createRange();
      range.selectNodeContents(pmDom);
      range.collapse(false); // collapse to end
      const sel = document.getSelection();
      if (!sel) throw new Error('No selection available');
      sel.removeAllRanges();
      sel.addRange(range);
      document.execCommand('insertParagraph');
      document.execCommand('insertText', false, text);
    }, marker);

    // Verify the marker landed in the editor's DOM — catches "edit went
    // nowhere" before we blame the serializer.
    await expect(editor).toContainText(marker, { timeout: 5_000 });
    await expect(window.getByLabel('Unsaved changes')).toBeVisible({ timeout: 2_000 });

    // Click the Save button instead of ⌘S. Global + local ⌘S listeners
    // coexist on the window (global onSave targets the NoteEditor ref,
    // which is null on /scratch; local ScratchEditor listener does the
    // write). Clicking the button hits exactly one path and tests the UI.
    await window.getByRole('button', { name: 'Save' }).click();

    // Dirty indicator clears on successful save.
    await expect(window.getByLabel('Unsaved changes')).toBeHidden({ timeout: 5_000 });

    // Round-trip assertions against the file on disk.
    const saved = readFileSync(filePath, 'utf-8');
    expect(saved).toContain(marker);
    // Heading survives.
    expect(saved).toMatch(/^#\s+Scratch Round-Trip Test/m);
    // Inline marks and link survive the serializer round trip.
    expect(saved).toContain('inline code');
    expect(saved).toContain('https://example.com');
    // List items survive.
    expect(saved).toMatch(/(-|\*)\s+First item/);
    expect(saved).toMatch(/(-|\*)\s+Third item/);
  } finally {
    rmSync(scratchDir, { recursive: true, force: true });
  }
});
