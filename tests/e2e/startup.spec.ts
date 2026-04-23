import { test, expect, primaryModifier } from './fixtures/electron';

// Startup is timing-sensitive (cold DB init + workspace scan + journal open).
// Tripling Playwright's per-test timeout keeps this reasonable on slower boxes.
test.slow();

test('measures full startup time', async ({ app }) => {
  // `app` is the fixture's launched instance — fixture setup time is NOT
  // counted here. We measure from first-window availability through
  // command-center render, which is the user-visible "ready to use" point.
  const startTime = performance.now();

  const window = await app.firstWindow();

  await expect(window.locator('#root')).toBeVisible();
  // Today's journal auto-opens; wait for the editor surface.
  await expect(window.locator('.ProseMirror')).toBeVisible();

  await window.keyboard.press(`${primaryModifier}+k`);
  await expect(window.locator('input[placeholder="Search notes and commands..."]')).toBeVisible();

  const startupTime = Math.round(performance.now() - startTime);
  console.log(`Total Startup Time (first window → command center): ${startupTime}ms`);

  // Envelope kept generous — the goal is to catch regressions, not enforce
  // a specific budget. Tighten if you want to treat this as a perf gate.
  expect(startupTime).toBeLessThan(10_000);
});
