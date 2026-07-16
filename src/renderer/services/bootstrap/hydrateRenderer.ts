export async function hydrateRendererServices(): Promise<void> {
  const [{ useShortcutsStore }, { useEditorConfigStore }] = await Promise.all([
    import('@renderer/features/settings/model/shortcutsStore'),
    import('@renderer/features/settings/model/editorConfigStore'),
  ]);
  await Promise.all([
    useShortcutsStore.getState().hydrate(),
    useEditorConfigStore.getState().hydrate(),
  ]);
}
