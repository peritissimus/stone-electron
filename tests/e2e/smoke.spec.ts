import { test, expect } from './fixtures/electron';

test('app launches and renderer becomes interactive', async ({ app }) => {
  const window = await app.firstWindow();
  await window.waitForLoadState('domcontentloaded');

  const title = await window.title();
  expect(title.length).toBeGreaterThan(0);

  await expect(window.locator('body')).toBeVisible();
});

test('primary pages stay inside a narrow window', async ({ app }) => {
  const window = await app.firstWindow();
  await app.evaluate(({ BrowserWindow }) => {
    BrowserWindow.getAllWindows()[0]?.setBounds({ width: 800, height: 900 });
  });

  await window.waitForLoadState('domcontentloaded');
  const routes = [
    '/today',
    '/journals',
    '/tasks',
    '/topics',
    '/meetings',
    '/graph',
    '/settings/appearance',
  ];

  for (const route of routes) {
    await window.evaluate((nextRoute) => {
      globalThis.location.hash = nextRoute;
    }, route);
    await expect.poll(() => window.evaluate(() => globalThis.location.hash)).toBe(`#${route}`);

    const hasHorizontalOverflow = await window.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(hasHorizontalOverflow, `${route} should not overflow horizontally`).toBe(false);

    const clippedControls = await window.evaluate(() =>
      Array.from(
        document.querySelectorAll<HTMLElement>('button, input, [role="button"], [role="combobox"]'),
      )
        .filter((element) => {
          const rect = element.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0 && (rect.left < 0 || rect.right > innerWidth + 1);
        })
        .map(
          (element) =>
            element.getAttribute('aria-label') ?? element.getAttribute('title') ?? element.innerText,
        ),
    );
    expect(clippedControls, `${route} should not clip interactive controls`).toEqual([]);
  }
});
