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

export interface EntityAPIOperations<T, TParams> {
  list: (params?: TParams) => Promise<IpcResponse<T[]>>;
  create?: (data: Partial<T>) => Promise<IpcResponse<T>>;
  update?: (id: string, data: Partial<T>) => Promise<IpcResponse<T>>;
  remove?: (id: string) => Promise<IpcResponse<void>>;
}

export interface EntityAPIConfig<T, TParams> {
  entityName: string;
  api: EntityAPIOperations<T, TParams>;
  useStore: () => EntityStoreActions<T>;
}

export interface EntityAPIResult<T, TParams> {
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
export function createEntityAPI<T extends { id: string }, TParams = Record<string, unknown>>(
  config: EntityAPIConfig<T, TParams>,
): () => EntityAPIResult<T, TParams> {
  return function useEntityAPI(): EntityAPIResult<T, TParams> {
    const store = config.useStore();

    const loadAll = useCallback(
      async (params?: TParams) =>
        runEntityOperation(
          config.entityName,
          'load',
          store,
          () => config.api.list(params),
          (items) => store.setItems(items),
          true,
        ),
      [store.setError, store.setItems, store.setLoading],
    );

    const create = useCallback(
      async (data: Partial<T>) => {
        if (!config.api.create) return null;
        return runEntityOperation(
          config.entityName,
          'create',
          store,
          () => config.api.create!(data),
          store.addItem,
          true,
        );
      },
      [store.addItem, store.setError, store.setLoading],
    );

    const update = useCallback(
      async (id: string, data: Partial<T>) => {
        if (!config.api.update) return null;
        return runEntityOperation(
          config.entityName,
          'update',
          store,
          () => config.api.update!(id, data),
          store.updateItem,
        );
      },
      [store.setError, store.updateItem],
    );

    const remove = useCallback(
      async (id: string) => {
        if (!config.api.remove) return false;
        store.setError(null);
        try {
          const response = await config.api.remove(id);
          if (!response.success) {
            store.setError(response.error?.message ?? `Failed to delete ${config.entityName}`);
            return false;
          }
          store.deleteItem(id);
          return true;
        } catch (error) {
          store.setError(toMessage(error, `Failed to delete ${config.entityName}`));
          return false;
        }
      },
      [store.deleteItem, store.setError],
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
