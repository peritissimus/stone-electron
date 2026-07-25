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

  // Sidebar starts collapsed (uiStore default). Open it via the "Expand" button
  // in the Today page header. The visible control is also our signal that the
  // application shell and initial route are ready for input.
  const expandSidebar = window.getByRole('button', { name: /^Expand( sidebar)?$/ }).first();
  await expect(expandSidebar).toBeVisible();
  await expandSidebar.click();
  await window.getByRole('button', { name: 'Knowledge' }).click();
  const indexResponse = await window.evaluate(
    async () =>
      // @ts-expect-error contextBridge API is intentionally untyped here
      window.electron.invoke('index:getStats', {}),
  );
  expect(indexResponse).toMatchObject({ success: true });

  // The page header always shows "Topics"; the spinner is the only child until
  // the initialize → loadTopics → getEmbeddingStatus chain resolves.
  const spinner = window.locator('.animate-spin').first();
  await expect(spinner).toBeHidden({ timeout: 60_000 });

  // Once initialization completes, the Knowledge page exposes its semantic
  // search surface and reports the index state in the page header.
  await expect(window.getByText('Knowledge', { exact: true }).last()).toBeVisible();
  await expect(window.getByText(/^(Indexed|\d+% indexed)$/)).toBeVisible({ timeout: 30_000 });
  await expect(
    window.getByRole('textbox', { name: 'Find notes by meaning, not just keywords…' }),
  ).toBeEnabled();

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

  // Hard assertions: nothing crashed loudly.
  const fatalRendererErrors = rendererErrors.filter((e) =>
    /xenova|transformers|onnx|worker/i.test(e),
  );
  expect(fatalRendererErrors, fatalRendererErrors.join('\n')).toHaveLength(0);

  const mainProcessFailures = mainLogs.filter((l) =>
    /Failed to initialize|MODULE_NOT_FOUND|Cannot find module|self is not defined/i.test(l),
  );
  expect(mainProcessFailures, mainProcessFailures.join('\n')).toHaveLength(0);
});
