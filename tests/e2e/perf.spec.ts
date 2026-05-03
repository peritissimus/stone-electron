/**
 * Large-document performance probe.
 *
 * Drives synthetic markdown files of increasing size through scratch mode
 * and times each leg of the open → render → save cycle. Not a pass/fail
 * gate — runs `expect.soft` so all sizes execute, and logs a table at the
 * end so you can see where the wheels come off.
 */

import { copyFileSync, existsSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir, homedir } from 'node:os';
import { basename, join } from 'node:path';
import { test, expect } from './fixtures/electron';

// Hard cap the whole probe: 6 cases × ~30s worst-case each, with a ceiling
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

// The synthetic generator is kept simple; real-world checks against actual
// files the user maintains exercise whatever feature mix that file has.
// Path kept outside the repo (user's workspace) so we can probe actual
// content without dragging 10+ KB fixture files into the test directory.
const REAL_FILES: Array<{ label: string; path: string }> = [
  {
    label: 'Stone Project.md',
    path: join(homedir(), 'NoteBook/Personal/Stone Project.md'),
  },
  {
    label: 'Stone_Editor_Preview.md',
    path: join(homedir(), 'NoteBook/Personal/Stone_Editor_Preview.md'),
  },
];

interface SyntheticCase {
  kind: 'synthetic';
  name: string;
  bytes: number;
}

interface RealCase {
  kind: 'real';
  label: string;
  path: string;
}

type Case = SyntheticCase | RealCase;

// Order matters: if we load the 1MB synthetic first, subsequent cases
// inherit a huge prior ProseMirror doc state that has to be cleared on
// each setContent — conflating "how fast does this file load" with "how
// fast does TipTap clear the previous state". Real files + small synthetic
// run first (cold editor state); larger synthetic go last.
const CASES: Case[] = [
  ...REAL_FILES.map<RealCase>((f) => ({ kind: 'real', label: f.label, path: f.path })),
  { kind: 'synthetic', name: '10KB', bytes: 10 * 1024 },
  { kind: 'synthetic', name: '100KB', bytes: 100 * 1024 },
  { kind: 'synthetic', name: '500KB', bytes: 500 * 1024 },
  { kind: 'synthetic', name: '1MB', bytes: 1024 * 1024 },
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
// The sentinel is stripped from the round-trip reading — it's an internal
// test artifact, not feature content.
const SENTINEL = 'perf-test-tail-anchor';

function resolveContentForCase(c: Case): { basename: string; content: string; src?: string } | null {
  if (c.kind === 'synthetic') {
    return {
      basename: `${c.name}-${Date.now()}.md`,
      content: makeBigMarkdown(c.bytes) + `\n${SENTINEL}\n`,
    };
  }
  if (!existsSync(c.path)) return null;
  const raw = readFileSync(c.path, 'utf-8');
  const withSentinel = raw.endsWith('\n') ? raw + `\n${SENTINEL}\n` : raw + `\n\n${SENTINEL}\n`;
  return {
    basename: `${basename(c.path).replace(/\.md$/i, '')}-${Date.now()}.md`,
    content: withSentinel,
    src: c.path,
  };
}

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
  await expect(editor).toBeVisible({ timeout: 15_000 });

  const results: Row[] = [];
  const cleanups: Array<() => void> = [];

  try {
    for (const c of CASES) {
      const label = c.kind === 'synthetic' ? c.name : c.label;
      await test.step(label, async () => {
        const resolved = resolveContentForCase(c);
        if (!resolved) {
          test.skip(true, `real file missing: ${c.kind === 'real' ? c.path : ''}`);
          return;
        }

        // We ALWAYS write to a tmpdir, never to the user's workspace —
        // for real-file cases we copy the content into a tmpdir so our
        // save-click doesn't mutate their file. The source path is only
        // used to read the content.
        const scratchDir = mkdtempSync(join(tmpdir(), `stone-perf-`));
        const filePath = join(scratchDir, resolved.basename);
        writeFileSync(filePath, resolved.content, 'utf-8');
        cleanups.push(() => rmSync(scratchDir, { recursive: true, force: true }));

        // Phase 1: IPC dispatch → scratch header visible.
        const t0 = Date.now();
        await app.evaluate(({ BrowserWindow }, p) => {
          const win = BrowserWindow.getAllWindows()[0];
          win?.webContents.send('scratch:openPath', p);
        }, filePath);
        await expect(window.getByText(resolved.basename, { exact: true }).first()).toBeVisible({
          timeout: PHASE_TIMEOUT_MS,
        });
        const t1 = Date.now();

        // Phase 2: editor contains visible content from the file (parse +
        // setContent + layout). Use the sentinel as the synchronization
        // token — it's guaranteed to be present and unique in the tail.
        await expect(editor).toContainText(SENTINEL, { timeout: PHASE_TIMEOUT_MS });
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

        const saveBtn = window.getByRole('button', { name: 'Save' });
        await expect(saveBtn).toBeEnabled({ timeout: PHASE_TIMEOUT_MS });
        const t3 = Date.now();
        await saveBtn.click();
        await expect(saveBtn).toBeDisabled({ timeout: PHASE_TIMEOUT_MS });
        const t4 = Date.now();

        results.push({
          label,
          bytes: statSync(filePath).size,
          ipcToHeaderMs: t1 - t0,
          headerToRenderMs: t2 - t1,
          saveMs: t4 - t3,
          totalOpenMs: t2 - t0,
        });
      });
    }
  } finally {
    for (const c of cleanups) c();
  }

  // Print a readable table.
  console.log('\n=== Scratch performance (ms) ===');
  console.log('case                          bytes     ipc→header  header→render  total-open   save');
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
