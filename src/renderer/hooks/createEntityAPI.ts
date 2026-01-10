/**
 * Entity API Factory - Generates CRUD hooks with consistent patterns
 *
 * Reduces boilerplate in API hooks by providing reusable CRUD operations
 * that integrate with Zustand stores and IPC channels.
 */

import { useCallback } from 'react';
import { invokeIpc, handleIpcResponse } from '@renderer/lib/ipc';
import { logger } from '@renderer/utils/logger';

/**
 * Channel configuration for entity operations
 */
export interface EntityChannels {
  GET_ALL: string;
  CREATE?: string;
  UPDATE?: string;
  DELETE?: string;
}

/**
 * Store actions that the factory can use
 * Uses generic names that map to entity-specific methods
 */
export interface EntityStoreActions<T> {
  setItems: (items: T[]) => void;
  addItem: (item: T) => void;
  updateItem: (item: T) => void;
  deleteItem: (id: string) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

/**
 * Configuration for creating an entity API
 */
export interface EntityAPIConfig<T> {
  /** Entity name for error messages (e.g., 'tag', 'notebook') */
  entityName: string;
  /** IPC channel configuration */
  channels: EntityChannels;
  /** Zustand store hook that returns the store actions */
  useStore: () => EntityStoreActions<T>;
  /** Key in the response object that contains the items array (e.g., 'tags', 'notebooks') */
  responseKey: string;
  /** Optional log prefix for debugging */
  logPrefix?: string;
}

/**
 * Result type for the generated API hook
 */
export interface EntityAPIResult<T, TParams = Record<string, unknown>> {
  /** Load all items with optional params */
  loadAll: (params?: TParams) => Promise<T[] | null>;
  /** Create a new item */
  create: (data: Partial<T>) => Promise<T | null>;
  /** Update an existing item */
  update: (id: string, data: Partial<T>) => Promise<T | null>;
  /** Delete an item by ID */
  remove: (id: string) => Promise<boolean>;
}

/**
 * Create an entity API hook with standard CRUD operations
 *
 * @example
 * ```typescript
 * const useTagCRUD = createEntityAPI<TagWithCount>({
 *   entityName: 'tag',
 *   channels: {
 *     GET_ALL: TAG_CHANNELS.GET_ALL,
 *     CREATE: TAG_CHANNELS.CREATE,
 *     DELETE: TAG_CHANNELS.DELETE,
 *   },
 *   useStore: () => {
 *     const store = useTagStore();
 *     return {
 *       setItems: store.setTags,
 *       addItem: store.addTag,
 *       updateItem: store.updateTag,
 *       deleteItem: store.deleteTag,
 *       setLoading: store.setLoading,
 *       setError: store.setError,
 *     };
 *   },
 *   responseKey: 'tags',
 * });
 *
 * // Use in component
 * const { loadAll, create, remove } = useTagCRUD();
 * ```
 */
export function createEntityAPI<T extends { id: string }, TParams = Record<string, unknown>>(
  config: EntityAPIConfig<T>,
): () => EntityAPIResult<T, TParams> {
  const { entityName, channels, useStore, responseKey, logPrefix } = config;
  const prefix = logPrefix || `[${entityName}API]`;

  return function useEntityAPI(): EntityAPIResult<T, TParams> {
    const { setItems, addItem, updateItem, deleteItem, setLoading, setError } = useStore();

    /**
     * Load all items
     */
    const loadAll = useCallback(
      async (params?: TParams): Promise<T[] | null> => {
        setLoading(true);
        setError(null);
        try {
          logger.info(`${prefix}.loadAll`, params);
          const response = await invokeIpc<Record<string, T[]>>(channels.GET_ALL, params);
          const result = handleIpcResponse(response, `Failed to load ${entityName}s`);

          if (result.success) {
            const items = result.data[responseKey];
            if (Array.isArray(items)) {
              setItems(items);
              logger.info(`${prefix}.loadAll loaded ${items.length} items`);
              return items;
            }
            // Handle case where response structure differs
            logger.warn(`${prefix}.loadAll unexpected response structure`, result.data);
            return null;
          }

          setError(result.error);
          return null;
        } catch (error) {
          const message = error instanceof Error ? error.message : `Failed to load ${entityName}s`;
          logger.error(`${prefix}.loadAll error`, error);
          setError(message);
          return null;
        } finally {
          setLoading(false);
        }
      },
      [setItems, setLoading, setError],
    );

    /**
     * Create a new item
     */
    const create = useCallback(
      async (data: Partial<T>): Promise<T | null> => {
        if (!channels.CREATE) {
          logger.warn(`${prefix}.create not configured`);
          return null;
        }

        setLoading(true);
        setError(null);
        try {
          logger.info(`${prefix}.create`, data);
          const response = await invokeIpc<T>(channels.CREATE, data);
          const result = handleIpcResponse(response, `Failed to create ${entityName}`);

          if (result.success) {
            addItem(result.data);
            logger.info(`${prefix}.create success`, result.data);
            return result.data;
          }

          setError(result.error);
          return null;
        } catch (error) {
          const message = error instanceof Error ? error.message : `Failed to create ${entityName}`;
          logger.error(`${prefix}.create error`, error);
          setError(message);
          return null;
        } finally {
          setLoading(false);
        }
      },
      [addItem, setLoading, setError],
    );

    /**
     * Update an existing item
     */
    const update = useCallback(
      async (id: string, data: Partial<T>): Promise<T | null> => {
        if (!channels.UPDATE) {
          logger.warn(`${prefix}.update not configured`);
          return null;
        }

        setError(null);
        try {
          logger.info(`${prefix}.update`, { id, ...data });
          const response = await invokeIpc<T>(channels.UPDATE, { id, ...data });
          const result = handleIpcResponse(response, `Failed to update ${entityName}`);

          if (result.success) {
            updateItem(result.data);
            logger.info(`${prefix}.update success`, result.data);
            return result.data;
          }

          setError(result.error);
          return null;
        } catch (error) {
          const message = error instanceof Error ? error.message : `Failed to update ${entityName}`;
          logger.error(`${prefix}.update error`, error);
          setError(message);
          return null;
        }
      },
      [updateItem, setError],
    );

    /**
     * Delete an item by ID
     */
    const remove = useCallback(
      async (id: string): Promise<boolean> => {
        if (!channels.DELETE) {
          logger.warn(`${prefix}.remove not configured`);
          return false;
        }

        setError(null);
        try {
          logger.info(`${prefix}.remove`, { id });
          const response = await invokeIpc<void>(channels.DELETE, { id });

          if (response.success) {
            deleteItem(id);
            logger.info(`${prefix}.remove success`);
            return true;
          }

          setError(response.error?.message || `Failed to delete ${entityName}`);
          return false;
        } catch (error) {
          const message = error instanceof Error ? error.message : `Failed to delete ${entityName}`;
          logger.error(`${prefix}.remove error`, error);
          setError(message);
          return false;
        }
      },
      [deleteItem, setError],
    );

    return { loadAll, create, update, remove };
  };
}

/**
 * Helper to create a simple IPC action (for entity-specific operations)
 *
 * @example
 * ```typescript
 * const toggleFavorite = useEntityAction<Note>(
 *   NOTE_CHANNELS.FAVORITE,
 *   'Failed to toggle favorite',
 *   setError,
 *   (note) => updateNote(note)
 * );
 * ```
 */
export function useEntityAction<T>(
  channel: string,
  errorMessage: string,
  setError: (error: string | null) => void,
  onSuccess?: (data: T) => void,
) {
  return useCallback(
    async (params: Record<string, unknown>): Promise<T | null> => {
      setError(null);
      try {
        const response = await invokeIpc<T>(channel, params);
        const result = handleIpcResponse(response, errorMessage);

        if (result.success) {
          if (onSuccess) {
            onSuccess(result.data);
          }
          return result.data;
        }

        setError(result.error);
        return null;
      } catch (error) {
        const message = error instanceof Error ? error.message : errorMessage;
        setError(message);
        return null;
      }
    },
    [channel, errorMessage, setError, onSuccess],
  );
}

/**
 * Helper to create a void IPC action (for operations that don't return data)
 */
export function useEntityVoidAction(
  channel: string,
  errorMessage: string,
  setError: (error: string | null) => void,
  onSuccess?: () => void,
) {
  return useCallback(
    async (params: Record<string, unknown>): Promise<boolean> => {
      setError(null);
      try {
        const response = await invokeIpc<void>(channel, params);

        if (response.success) {
          if (onSuccess) {
            onSuccess();
          }
          return true;
        }

        setError(response.error?.message || errorMessage);
        return false;
      } catch (error) {
        const message = error instanceof Error ? error.message : errorMessage;
        setError(message);
        return false;
      }
    },
    [channel, errorMessage, setError, onSuccess],
  );
}
