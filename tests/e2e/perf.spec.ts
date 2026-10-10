/**
 * Large-document performance probe.
 *
 * Drives synthetic markdown files of increasing size through scratch mode
 * and times each leg of the open → render → save cycle. Phase timeouts
 * stop the run; completed cases are logged as they finish. Generated fixtures
 * give clean CI runners the same cases as developer machines.
 */

import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test, expect } from './fixtures/electron';

// DOM snapshots of thousands of code controls can cost more than the app
// itself. Measure the editor without tracing instrumentation or warm retries.
test.use({ recordTrace: false });
test.describe.configure({ retries: 0 });

// Hard cap the whole probe: four synthetic cases, with a ceiling
// that fails the test rather than letting it hang if something wedges.
test.setTimeout(240_000);

// Per-phase timeout: any single phase (route+mount, render, or save) that
// exceeds this is pathological. Keeps the test bounded instead of stacking
// 60s waits on each phase across all cases.
const PHASE_TIMEOUT_MS = 20_000;

// Generate synthetic markdown around `targetBytes` bytes. The block is
// feature-mixed so parser/serializer/renderer hit their realistic code
// paths (not a wall of plain prose).
function makeBigMarkdown(targetBytes: number): string {
  const block = [
    '## Section Header',
    '',
    'Lorem ipsum dolor sit amet, **consectetur** adipiscing elit, sed do _eiusmod_ tempor incididunt ut labore et dolore magna aliqua.',
    '',
    '- Item with `inline code`',
    '- Item with [an external link](https://example.com)',
    '- Item three, plain text',
    '',
    '> A short blockquote to exercise the quote node.',
    '',
    '```javascript',
    'function greet(name) {',
    '  return `Hello, ${name}!`;',
    '}',
    '```',
    '',
  ].join('\n');
  let out = '# Large Document Perf Test\n\n';
  while (out.length < targetBytes) {
    out += block;
  }
  return out;
}

// Small documents run first so large prior editor state cannot distort the
// small-document baseline. Never depend on files from a developer's home.
const CASES = [
  { name: '10KB', bytes: 10 * 1024 },
  { name: '100KB', bytes: 100 * 1024 },
  { name: '500KB', bytes: 500 * 1024 },
  { name: '1MB', bytes: 1024 * 1024 },
];

interface Row {
  label: string;
  bytes: number;
  ipcToHeaderMs: number;
  headerToRenderMs: number;
  saveMs: number;
  totalOpenMs: number;
}

// Sentinel trailing paragraph appended to every file we open so our
// `execCommand`-based end-of-doc edit lands in plain text, not inside a
// final code fence / blockquote / table where `insertText` silently no-ops.
// Each case uses a distinct sentinel to prove the new document has loaded.
const SENTINEL = 'perf-test-tail-anchor';

test('perf: large-document open + save', async ({ app }) => {
  const window = await app.firstWindow();
  await window.waitForLoadState('domcontentloaded');
  // Capture renderer-side save timings emitted by useScratchDocument.
  // The logger uses console.info under the hood; we filter for our marker.
  const saveTimings: Array<{ getMarkdownMs: number; ipcWriteMs: number; bytes: number }> = [];
  window.on('console', (msg) => {
    const text = msg.text();
    if (!text.includes('[Scratch] save timings')) return;
    // Extract the JSON-ish payload following the message prefix.
    const match = text.match(/bytes:\s*(\d+).*getMarkdownMs:\s*(\d+).*ipcWriteMs:\s*(\d+)/s);
    if (match) {
      saveTimings.push({
        bytes: parseInt(match[1], 10),
        getMarkdownMs: parseInt(match[2], 10),
        ipcWriteMs: parseInt(match[3], 10),
      });
    }
  });

  const editor = window.locator('.ProseMirror');
  // Scope controls to the header so role queries do not walk thousands of
  // code-block toolbar buttons while measuring the editor.
  const header = window.locator('[data-scratch-status] > div').first();

  const results: Row[] = [];
  const cleanups: Array<() => void> = [];

  try {
    for (const c of CASES) {
      const label = c.name;
      await test.step(label, async () => {
        const fileName = `${c.name}-${Date.now()}.md`;
        const sentinel = `${SENTINEL}-${c.name}`;
        const content = makeBigMarkdown(c.bytes) + `\n${sentinel}\n`;
        const scratchDir = mkdtempSync(join(tmpdir(), 'stone-perf-'));
        const filePath = join(scratchDir, fileName);
        writeFileSync(filePath, content, 'utf-8');
        cleanups.push(() => rmSync(scratchDir, { recursive: true, force: true }));

        // Phase 1: IPC dispatch → scratch header visible.
        const t0 = Date.now();
        await app.evaluate(({ BrowserWindow }, p) => {
          const win = BrowserWindow.getAllWindows()[0];
          win?.webContents.send('scratch:openPath', p);
        }, filePath);
        // Locator assertions build full accessibility snapshots on a miss,
        // which can block this large page before React commits the next file.
        // Equivalent bounded waits keep that diagnostic work out of timings.
        await header.getByText(fileName, { exact: true }).waitFor({
          state: 'visible',
          timeout: PHASE_TIMEOUT_MS,
        });
        await editor.waitFor({ state: 'visible', timeout: PHASE_TIMEOUT_MS });
        const t1 = Date.now();

        // Phase 2: editor contains visible content from the file (parse +
        // setContent + layout). Use the sentinel as the synchronization
        // token — it's guaranteed to be present and unique in the tail.
        await editor.getByText(sentinel, { exact: true }).waitFor({
          state: 'visible',
          timeout: PHASE_TIMEOUT_MS,
        });
        const t2 = Date.now();

        // Phase 3: force dirty + measure save.
        const marker = `perf-marker-${Date.now()}`;
        await window.evaluate((m) => {
          const pm = document.querySelector('.ProseMirror') as HTMLElement | null;
          if (!pm) throw new Error('no prose mirror');
          pm.focus();
          const range = document.createRange();
          range.selectNodeContents(pm);
          range.collapse(false);
          const sel = document.getSelection();
          if (!sel) throw new Error('no selection');
          sel.removeAllRanges();
          sel.addRange(range);
          document.execCommand('insertParagraph');
          document.execCommand('insertText', false, m);
        }, marker);

        const saveBtn = header.getByRole('button', { name: 'Save' });
        await expect.poll(() => saveBtn.isEnabled(), { timeout: PHASE_TIMEOUT_MS }).toBe(true);
        const t3 = Date.now();
        await saveBtn.click();
        await expect.poll(() => saveBtn.isEnabled(), { timeout: PHASE_TIMEOUT_MS }).toBe(false);
        const t4 = Date.now();
        expect(readFileSync(filePath, 'utf-8'), `${label}: saved edit marker`).toContain(marker);

        const result = {
          label,
          bytes: statSync(filePath).size,
          ipcToHeaderMs: t1 - t0,
          headerToRenderMs: t2 - t1,
          saveMs: t4 - t3,
          totalOpenMs: t2 - t0,
        };
        results.push(result);
        console.log(`[perf] ${label}: open=${result.totalOpenMs}ms, save=${result.saveMs}ms`);
      });
    }
  } finally {
    for (const c of cleanups) c();
  }

  // Print a readable table.
  console.log('\n=== Scratch performance (ms) ===');
  console.log(
    'case                          bytes     ipc→header  header→render  total-open   save',
  );
  for (const r of results) {
    const row = [
      r.label.padEnd(30),
      r.bytes.toString().padStart(8),
      r.ipcToHeaderMs.toString().padStart(11),
      r.headerToRenderMs.toString().padStart(14),
      r.totalOpenMs.toString().padStart(11),
      r.saveMs.toString().padStart(6),
    ].join(' ');
    console.log(row);
  }

  // Save-phase breakdown captured from the renderer console.
  if (saveTimings.length > 0) {
    console.log('\n=== Save breakdown (ms) ===');
    console.log('bytes      getMarkdown  ipcWrite');
    for (const t of saveTimings) {
      console.log(
        [
          t.bytes.toString().padStart(8),
          t.getMarkdownMs.toString().padStart(11),
          t.ipcWriteMs.toString().padStart(9),
        ].join('  '),
      );
    }
  }

  expect.soft(saveTimings.length, 'captured save timing rows').toBe(results.length);

  // Generous envelopes — breach implies a serious regression.
  for (const r of results) {
    expect.soft(r.totalOpenMs, `${r.label}: total open`).toBeLessThan(20_000);
    expect.soft(r.saveMs, `${r.label}: save`).toBeLessThan(20_000);
  }
});
