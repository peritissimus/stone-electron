import { useCallback } from 'react';
import type { IpcResponse } from '@shared/types';
import { logger } from '@renderer/services/telemetry/logger';

export interface EntityStoreActions<T> {
  setItems: (items: T[]) => void;
  addItem: (item: T) => void;
  updateItem: (item: T) => void;
  deleteItem: (id: string) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

export interface EntityCommandOperations<T, TParams> {
  list: (params?: TParams) => Promise<IpcResponse<T[]>>;
  create?: (data: Partial<T>) => Promise<IpcResponse<T>>;
  update?: (id: string, data: Partial<T>) => Promise<IpcResponse<T>>;
  remove?: (id: string) => Promise<IpcResponse<void>>;
}

export interface EntityCommandsConfig<T, TParams> {
  entityName: string;
  api: EntityCommandOperations<T, TParams>;
  useStore: () => EntityStoreActions<T>;
}

export interface EntityCommandsResult<T, TParams> {
  loadAll: (params?: TParams) => Promise<T[] | null>;
  create: (data: Partial<T>) => Promise<T | null>;
  update: (id: string, data: Partial<T>) => Promise<T | null>;
  remove: (id: string) => Promise<boolean>;
}

/**
 * Builds consistent entity commands above the validated API modules. The
 * factory never invokes IPC directly, so response validation cannot be
 * bypassed by a store or command hook.
 */
export function createEntityCommands<T extends { id: string }, TParams = Record<string, unknown>>(
  config: EntityCommandsConfig<T, TParams>,
): () => EntityCommandsResult<T, TParams> {
  return function useEntityCommands(): EntityCommandsResult<T, TParams> {
    const { setItems, addItem, updateItem, deleteItem, setLoading, setError } = config.useStore();

    const loadAll = useCallback(
      async (params?: TParams) =>
        runEntityOperation(
          config.entityName,
          'load',
          { setLoading, setError },
          () => config.api.list(params),
          (items) => setItems(items),
          true,
        ),
      [setError, setItems, setLoading],
    );

    const create = useCallback(
      async (data: Partial<T>) => {
        if (!config.api.create) return null;
        return runEntityOperation(
          config.entityName,
          'create',
          { setLoading, setError },
          () => config.api.create!(data),
          addItem,
          true,
        );
      },
      [addItem, setError, setLoading],
    );

    const update = useCallback(
      async (id: string, data: Partial<T>) => {
        if (!config.api.update) return null;
        return runEntityOperation(
          config.entityName,
          'update',
          { setLoading, setError },
          () => config.api.update!(id, data),
          updateItem,
        );
      },
      [setError, setLoading, updateItem],
    );

    const remove = useCallback(
      async (id: string) => {
        if (!config.api.remove) return false;
        setError(null);
        try {
          const response = await config.api.remove(id);
          if (!response.success) {
            setError(response.error?.message ?? `Failed to delete ${config.entityName}`);
            return false;
          }
          deleteItem(id);
          return true;
        } catch (error) {
          setError(toMessage(error, `Failed to delete ${config.entityName}`));
          return false;
        }
      },
      [deleteItem, setError],
    );

    return { loadAll, create, update, remove };
  };
}

async function runEntityOperation<T>(
  entityName: string,
  operation: string,
  store: Pick<EntityStoreActions<T>, 'setError' | 'setLoading'>,
  request: () => Promise<IpcResponse<T>>,
  apply: (data: T) => void,
  loading = false,
): Promise<T | null> {
  if (loading) store.setLoading(true);
  store.setError(null);
  try {
    const response = await request();
    if (!response.success || response.data === undefined) {
      store.setError(response.error?.message ?? `Failed to ${operation} ${entityName}`);
      return null;
    }
    apply(response.data);
    return response.data;
  } catch (error) {
    const message = toMessage(error, `Failed to ${operation} ${entityName}`);
    logger.error(`[${entityName}API] ${operation} failed`, error);
    store.setError(message);
    return null;
  } finally {
    if (loading) store.setLoading(false);
  }
}

function toMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}
