import { test, expect } from './fixtures/electron';

// Topics initialization spawns a worker thread that loads @xenova/transformers
// and an ONNX model. First run can be slow on a cold cache.
test.slow();

test('topics page initializes the embedder without errors', async ({ app }) => {
  const mainLogs: string[] = [];
  const rendererErrors: string[] = [];

  // Capture main-process stdout/stderr — that's where [Embedder] / [Worker] logs land.
  app.process().stdout?.on('data', (chunk) => mainLogs.push(`[stdout] ${chunk.toString()}`));
  app.process().stderr?.on('data', (chunk) => mainLogs.push(`[stderr] ${chunk.toString()}`));

  const window = await app.firstWindow();
  await window.waitForLoadState('domcontentloaded');

  window.on('console', (msg) => {
    if (msg.type() === 'error') rendererErrors.push(msg.text());
  });
  window.on('pageerror', (err) => rendererErrors.push(`pageerror: ${err.message}`));

  await expect(window.locator('#root')).toBeVisible();
  // Today's journal auto-opens, signalling the app is ready for input.
  await expect(window.locator('.ProseMirror')).toBeVisible();

  // Sidebar starts collapsed (uiStore default). Open it via the "Expand" button
  // in the page header before clicking the Topics nav link.
  await window.getByRole('button', { name: /^Expand( sidebar)?$/ }).first().click();
  await window.getByRole('button', { name: 'Topics' }).click();

  // The page header always shows "Topics"; the spinner is the only child until
  // the initialize → loadTopics → getEmbeddingStatus chain resolves.
  const spinner = window.locator('.animate-spin').first();
  await expect(spinner).toBeVisible();
  await expect(spinner).toBeHidden({ timeout: 60_000 });

  // Footer reports the embedder state — "Ready" or "Not initialized".
  const statusFooter = window.locator('text=/Ready|Not initialized/').first();
  await expect(statusFooter).toBeVisible({ timeout: 30_000 });
  const statusText = await statusFooter.textContent();
  console.log(`[topics] status footer: ${statusText}`);

  // Dump captured logs so we can see the embedder boot path even on success.
  const embedderLogs = mainLogs.filter((l) => /Embedder|xenova|onnx|worker/i.test(l));
  if (embedderLogs.length) {
    console.log('--- main-process embedder logs ---');
    for (const line of embedderLogs) console.log(line.trim());
  }
  if (rendererErrors.length) {
    console.log('--- renderer errors ---');
    for (const e of rendererErrors) console.log(e);
  }

  // Soft assertion: surface the failure but keep collecting evidence.
  expect.soft(statusText).toContain('Ready');

  // Hard assertions: nothing crashed loudly.
  const fatalRendererErrors = rendererErrors.filter(
    (e) => /xenova|transformers|onnx|worker/i.test(e),
  );
  expect(fatalRendererErrors, fatalRendererErrors.join('\n')).toHaveLength(0);

  const mainProcessFailures = mainLogs.filter((l) =>
    /Failed to initialize|MODULE_NOT_FOUND|Cannot find module|self is not defined/i.test(l),
  );
  expect(mainProcessFailures, mainProcessFailures.join('\n')).toHaveLength(0);
});
