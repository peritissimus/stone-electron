import { join } from 'node:path';
import { test, expect, primaryModifier } from './fixtures/electron';

test('production renderer, IPC, persistence, and content policy work together', async ({
  app,
  userDataDir,
}) => {
  const page = await app.firstWindow();
  await page.waitForLoadState('domcontentloaded');
  expect(await app.evaluate(({ app: electronApp }) => electronApp.getPath('userData'))).toBe(
    userDataDir,
  );

  const policy = await page
    .locator('meta[http-equiv="Content-Security-Policy"]')
    .getAttribute('content');
  expect(policy).toContain("default-src 'none'");
  expect(policy).toContain("script-src 'self' 'sha256-");
  expect(policy).not.toContain("'unsafe-eval'");

  const result = await page.evaluate(
    async (workspacePath) => {
      const created = await window.electron.invoke<{ id: string }>('workspaces:create', {
        name: 'Release smoke',
        path: workspacePath,
      });
      if (!created.success || !created.data) throw new Error('Workspace creation failed');
      const active = await window.electron.invoke('workspaces:setActive', { id: created.data.id });
      if (!active.success) throw new Error('Workspace activation failed');
      const note = await window.electron.invoke<{ id: string }>('notes:create', {
        workspaceId: created.data.id,
        title: 'Release smoke note',
        content: 'A persisted release smoke marker.',
      });
      if (!note.success || !note.data) throw new Error('Note creation failed');
      return await window.electron.invoke('notes:getContent', { id: note.data.id });
    },
    join(userDataDir, 'release-workspace'),
  );
  expect(result).toMatchObject({
    success: true,
    data: { content: expect.stringContaining('release smoke marker') },
  });

  await page.reload();
  await expect(page.getByRole('button', { name: /^Expand( sidebar)?$/ }).first()).toBeVisible();
  await page.keyboard.press(`${primaryModifier}+k`);
  await expect(page.locator('input[placeholder="Search notes and commands..."]')).toBeVisible();

  // Exercise Chromium's actual policy rather than only asserting the meta text.
  const inlineExecuted = await page.evaluate(() => {
    const script = document.createElement('script');
    script.textContent = 'document.documentElement.dataset.untrustedScript = "executed"';
    document.body.append(script);
    script.remove();
    return document.documentElement.dataset.untrustedScript;
  });
  expect(inlineExecuted).toBeUndefined();
});
