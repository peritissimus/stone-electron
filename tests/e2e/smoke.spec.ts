import { test, expect } from './fixtures/electron';

test('app launches and renderer becomes interactive', async ({ app }) => {
  const window = await app.firstWindow();
  await window.waitForLoadState('domcontentloaded');

  const title = await window.title();
  expect(title.length).toBeGreaterThan(0);

  await expect(window.locator('body')).toBeVisible();
});
