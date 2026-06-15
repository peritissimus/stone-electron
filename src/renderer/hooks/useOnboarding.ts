/**
 * useOnboarding — first-launch flow for creating the very first notebook
 * workspace. Wraps useWorkspaceAPI so the onboarding screen stays a pure
 * component: it resolves a suggested default location, lets the user pick a
 * different folder, then creates + activates the workspace.
 *
 * Also exposes the local-model warm-up commands the wizard's "download
 * models" step uses (embedding model + Whisper), so neither model has to
 * lazily download on first real use.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useWorkspaceAPI } from '@renderer/hooks/useWorkspaceAPI';
import { useWorkspaceStore } from '@renderer/stores/workspaceStore';
import { useOnboardingStore } from '@renderer/stores/onboardingStore';
import {
  topicAPI,
  aiAPI,
  systemAPI,
  type MicAccessStatus,
  type SystemAudioAccess,
} from '@renderer/api';
import { subscribe } from '@renderer/lib/events';
import { EVENTS } from '@shared/constants/ipcChannels';
import type { MLModelDownloadProgressPayload } from '@shared/types/mlStatus';

export interface CompleteOnboardingInput {
  name: string;
  path: string;
}

export function useOnboarding() {
  const { getDefaultWorkspacePath, selectFolder, createWorkspace, setActiveWorkspace } =
    useWorkspaceAPI();
  const workspaces = useWorkspaceStore((s) => s.workspaces);
  const markSteps = useOnboardingStore((s) => s.markSteps);
  const completeOnboardingState = useOnboardingStore((s) => s.complete);

  // When onboarding is re-run after a workspace already exists (e.g. a new
  // step shipped in an update), surface the existing workspace so the wizard
  // can prefill its path/name instead of pretending it's a clean first run.
  const existingWorkspace =
    workspaces.find((w) => w.isActive) ?? workspaces[0] ?? null;

  const completeOnboarding = useCallback(
    async ({ name, path }: CompleteOnboardingInput) => {
      // A workspace already pointing at this folder means we're re-running the
      // wizard, not setting up from scratch — don't try to recreate it, just
      // make sure it's active and record that onboarding is done.
      const already = workspaces.find((w) => w.folderPath === path);
      const workspace = already ?? (await createWorkspace({ name: name.trim(), path }));
      if (!workspace) return null;
      // Activate so templates seed, caches clear, and the app navigates home.
      await setActiveWorkspace(workspace.id);
      await markSteps({ workspace: true });
      await completeOnboardingState();
      return workspace;
    },
    [workspaces, createWorkspace, setActiveWorkspace, markSteps, completeOnboardingState],
  );

  /** Download/load the local embedding model (search, topics). ~35 MB once. */
  const warmUpEmbeddings = useCallback(async () => {
    try {
      const response = await topicAPI.initialize();
      return Boolean(response.success && response.data?.ready);
    } catch {
      return false;
    }
  }, []);

  /** Download/load Whisper (meeting + voice transcription). ~80 MB once. */
  const warmUpWhisper = useCallback(async () => {
    try {
      const response = await aiAPI.warmTranscriber();
      return Boolean(response.success && response.data?.ready);
    } catch {
      return false;
    }
  }, []);

  return {
    getDefaultWorkspacePath,
    selectFolder,
    completeOnboarding,
    markSteps,
    existingWorkspace,
    warmUpEmbeddings,
    warmUpWhisper,
  };
}

/**
 * Microphone permission state for the onboarding "local setup" step.
 * 'unknown' (Linux / no TCC) is treated as fine — getUserMedia just works.
 */
export function useMicPermission() {
  const [status, setStatus] = useState<MicAccessStatus | null>(null);
  const [requesting, setRequesting] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const response = await systemAPI.getMicAccessStatus();
      if (response.success && response.data) setStatus(response.data.status);
    } catch {
      // Leave status null — the row renders as "unknown" and stays harmless.
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const request = useCallback(async () => {
    setRequesting(true);
    try {
      const response = await systemAPI.requestMicAccess();
      if (response.success && response.data) {
        setStatus(response.data.status);
        return response.data.granted;
      }
      return false;
    } catch {
      return false;
    } finally {
      setRequesting(false);
    }
  }, []);

  const openSettings = useCallback(() => {
    void systemAPI.openExternal(
      'x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone',
    );
  }, []);

  return { status, requesting, refresh, request, openSettings };
}

/**
 * Screen & System Audio Recording permission state (macOS). 'unsupported'
 * on other platforms — callers hide the affordance entirely.
 */
export function useSystemAudioPermission() {
  const [status, setStatus] = useState<SystemAudioAccess | null>(null);
  const [requesting, setRequesting] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const response = await systemAPI.getSystemAudioAccess();
      if (response.success && response.data) setStatus(response.data.status);
    } catch {
      // Leave null — row stays hidden.
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const request = useCallback(async () => {
    setRequesting(true);
    try {
      const response = await systemAPI.requestSystemAudioAccess();
      if (response.success && response.data) {
        setStatus(response.data.status);
        return response.data.status === 'granted';
      }
      return false;
    } catch {
      return false;
    } finally {
      setRequesting(false);
    }
  }, []);

  const openSettings = useCallback(() => {
    void systemAPI.openExternal(
      'x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture',
    );
  }, []);

  return { status, requesting, refresh, request, openSettings };
}

export interface ModelDownloadProgress {
  /** 0–100 across all files seen so far for this model. */
  percent: number;
  loadedBytes: number;
  totalBytes: number;
}

/**
 * Live download progress for the local models, aggregated across the
 * multiple files each model repo ships (the .onnx weights dominate).
 * Null until the first progress event for that model arrives.
 */
export function useModelDownloadProgress() {
  const [embedding, setEmbedding] = useState<ModelDownloadProgress | null>(null);
  const [whisper, setWhisper] = useState<ModelDownloadProgress | null>(null);

  // file → {loaded, total}, per model. Refs: aggregation state, not render state.
  const filesRef = useRef<Record<string, Map<string, { loaded: number; total: number }>>>({
    embedding: new Map(),
    whisper: new Map(),
  });

  useEffect(() => {
    return subscribe(EVENTS.ML_MODEL_DOWNLOAD_PROGRESS, (raw: unknown) => {
      const payload = raw as MLModelDownloadProgressPayload;
      if (payload.model !== 'embedding' && payload.model !== 'whisper') return;

      const files = filesRef.current[payload.model];
      files.set(payload.file, { loaded: payload.loaded, total: payload.total });

      let loadedBytes = 0;
      let totalBytes = 0;
      for (const f of files.values()) {
        loadedBytes += f.loaded;
        totalBytes += f.total;
      }
      const next: ModelDownloadProgress = {
        percent: totalBytes > 0 ? Math.min(100, Math.round((loadedBytes / totalBytes) * 100)) : 0,
        loadedBytes,
        totalBytes,
      };
      if (payload.model === 'embedding') setEmbedding(next);
      else setWhisper(next);
    });
  }, []);

  return { embedding, whisper };
}
