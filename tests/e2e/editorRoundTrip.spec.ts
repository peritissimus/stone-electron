/**
 * Editor feature round-trip matrix.
 *
 * For each feature we drop a markdown file through the scratch editor,
 * append a marker, save, and assert the saved markdown preserves the
 * feature-specific construct. This catches any regression in either the
 * markdown → ProseMirror parser OR the ProseMirror → markdown serializer.
 *
 * One Electron app launch drives all cases to keep the test fast;
 * failures in one feature don't block the others (each case has its own
 * `expect.soft` + per-case cleanup).
 */

import { test, expect } from './fixtures/electron';
import { roundTripMarkdown } from './fixtures/roundTrip';

test.slow(); // multiple round-trips per test — give the suite headroom

interface FeatureCase {
  name: string;
  input: string;
  // Called with the saved markdown AND the unique marker that was appended
  // to force the save. Feature assertions live here.
  assert: (saved: string) => void;
}

const CASES: FeatureCase[] = [
  {
    name: 'headings h1-h6',
    input: [
      '# H1 heading',
      '',
      '## H2 heading',
      '',
      '### H3 heading',
      '',
      '#### H4 heading',
      '',
      '##### H5 heading',
      '',
      '###### H6 heading',
      '',
    ].join('\n'),
    assert: (saved) => {
      for (let level = 1; level <= 6; level++) {
        expect.soft(saved).toMatch(new RegExp(`^#{${level}}\\s+H${level} heading`, 'm'));
      }
    },
  },
  {
    name: 'bold italic strike inline-code',
    input: 'A paragraph with **bold**, *italic*, ~~strike~~, and `code` inline.\n',
    assert: (saved) => {
      expect.soft(saved).toContain('**bold**');
      // Italic may serialize as `*italic*` or `_italic_` — accept either.
      expect.soft(saved).toMatch(/(\*italic\*|_italic_)/);
      expect.soft(saved).toContain('~~strike~~');
      expect.soft(saved).toContain('`code`');
    },
  },
  {
    name: 'link',
    input: 'Visit [Example](https://example.com "Title here") for info.\n',
    assert: (saved) => {
      expect.soft(saved).toMatch(/\[Example\]\(https:\/\/example\.com/);
    },
  },
  {
    name: 'bullet list',
    input: ['- Alpha', '- Beta', '- Gamma', ''].join('\n'),
    assert: (saved) => {
      expect.soft(saved).toMatch(/(-|\*)\s+Alpha/);
      expect.soft(saved).toMatch(/(-|\*)\s+Beta/);
      expect.soft(saved).toMatch(/(-|\*)\s+Gamma/);
    },
  },
  {
    name: 'ordered list',
    input: ['1. First', '2. Second', '3. Third', ''].join('\n'),
    assert: (saved) => {
      expect.soft(saved).toMatch(/1\.\s+First/);
      expect.soft(saved).toMatch(/2\.\s+Second/);
      expect.soft(saved).toMatch(/3\.\s+Third/);
    },
  },
  {
    name: 'nested bullet list',
    input: ['- Outer', '  - Inner', '    - Deeper', ''].join('\n'),
    assert: (saved) => {
      expect.soft(saved).toMatch(/(-|\*)\s+Outer/);
      // Indentation style may vary — accept any whitespace before Inner.
      expect.soft(saved).toMatch(/\s+(-|\*)\s+Inner/);
    },
  },
  {
    name: 'blockquote',
    input: '> A quoted line of thought.\n',
    assert: (saved) => {
      expect.soft(saved).toMatch(/^>\s+A quoted line of thought/m);
    },
  },
  {
    name: 'horizontal rule',
    input: 'Before rule.\n\n---\n\nAfter rule.\n',
    assert: (saved) => {
      expect.soft(saved).toContain('Before rule.');
      expect.soft(saved).toMatch(/^---\s*$/m);
      expect.soft(saved).toContain('After rule.');
    },
  },
  {
    name: 'fenced code block (javascript)',
    input: ['```javascript', "const greeting = 'hello';", 'console.log(greeting);', '```', ''].join('\n'),
    assert: (saved) => {
      expect.soft(saved).toMatch(/```javascript/);
      expect.soft(saved).toContain("const greeting = 'hello';");
      expect.soft(saved).toContain('console.log(greeting);');
    },
  },
  {
    name: 'fenced code block (mermaid)',
    input: ['```mermaid', 'graph TD', '  A --> B', '  B --> C', '```', ''].join('\n'),
    assert: (saved) => {
      expect.soft(saved).toMatch(/```mermaid/);
      expect.soft(saved).toContain('graph TD');
      expect.soft(saved).toContain('A --> B');
    },
  },
  {
    name: 'table',
    input: [
      '| Name | Age |',
      '| --- | --- |',
      '| Alice | 30 |',
      '| Bob | 25 |',
      '',
    ].join('\n'),
    assert: (saved) => {
      // Serializer produces its own row/divider shape; assert on cells.
      expect.soft(saved).toContain('Name');
      expect.soft(saved).toContain('Age');
      expect.soft(saved).toContain('Alice');
      expect.soft(saved).toContain('30');
      expect.soft(saved).toContain('Bob');
      expect.soft(saved).toMatch(/\|.*---.*\|/);
    },
  },
];

test('editor feature round-trip matrix', async ({ app }) => {
  const window = await app.firstWindow();
  await window.waitForLoadState('domcontentloaded');

  const editor = window.locator('.ProseMirror');
  await expect(editor).toBeVisible({ timeout: 15_000 });

  const cleanups: Array<() => void> = [];

  try {
    for (const testCase of CASES) {
      await test.step(testCase.name, async () => {
        const { saved, marker, cleanup } = await roundTripMarkdown(
          app,
          window,
          editor,
          testCase.input,
          { name: testCase.name.replace(/[^\w]+/g, '-') },
        );
        cleanups.push(cleanup);

        // The marker is the universal "did the save happen" check — if
        // this fails, the feature assertion is moot.
        expect.soft(saved, `${testCase.name}: marker missing from saved file`).toContain(marker);
        testCase.assert(saved);
      });
    }
  } finally {
    for (const c of cleanups) c();
  }
});
