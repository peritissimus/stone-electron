/**
 * useOnboarding — first-launch flow for creating the very first notebook
 * workspace. Wraps useWorkspaceAPI so the onboarding screen stays a pure
 * component: it resolves a suggested default location, lets the user pick a
 * different folder, then creates + activates the workspace.
 */

import { useCallback } from 'react';
import { useWorkspaceAPI } from '@renderer/hooks/useWorkspaceAPI';

export interface CompleteOnboardingInput {
  name: string;
  path: string;
}

export function useOnboarding() {
  const { getDefaultWorkspacePath, selectFolder, createWorkspace, setActiveWorkspace } =
    useWorkspaceAPI();

  const completeOnboarding = useCallback(
    async ({ name, path }: CompleteOnboardingInput) => {
      const workspace = await createWorkspace({ name: name.trim(), path });
      if (!workspace) return null;
      // Activate so templates seed, caches clear, and the app navigates home.
      await setActiveWorkspace(workspace.id);
      return workspace;
    },
    [createWorkspace, setActiveWorkspace],
  );

  return { getDefaultWorkspacePath, selectFolder, completeOnboarding };
}
