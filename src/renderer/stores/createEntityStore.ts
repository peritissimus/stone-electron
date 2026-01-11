/**
 * Entity Store Factory - Creates Zustand stores with common CRUD patterns
 *
 * Implements: specs/stores.ts#SingleSelectStore, specs/stores.ts#MultiSelectStore
 *
 * Reduces duplication between similar stores like tagStore and topicStore.
 */

import { create } from 'zustand';

/**
 * Base entity interface - all entities must have an id
 */
interface BaseEntity {
  id: string;
}

/**
 * Common state shared by all entity stores
 */
interface CommonState {
  loading: boolean;
  error: string | null;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

/**
 * State for stores with single selection (like topics)
 */
interface SingleSelectState<T extends BaseEntity> extends CommonState {
  items: T[];
  selectedId: string | null;
  setItems: (items: T[]) => void;
  addItem: (item: T) => void;
  updateItem: (id: string, updates: Partial<T>) => void;
  deleteItem: (id: string) => void;
  selectItem: (id: string | null) => void;
  getItemById: (id: string) => T | null;
}

/**
 * State for stores with multi-selection (like tags)
 */
interface MultiSelectState<T extends BaseEntity> extends CommonState {
  items: T[];
  selectedIds: string[];
  setItems: (items: T[]) => void;
  addItem: (item: T) => void;
  updateItem: (id: string, updates: Partial<T>) => void;
  deleteItem: (id: string) => void;
  selectItem: (id: string) => void;
  deselectItem: (id: string) => void;
  toggleItem: (id: string) => void;
  clearSelection: () => void;
  getSelectedItems: () => T[];
  getItemById: (id: string) => T | null;
}

/**
 * Options for store creation
 */
interface StoreOptions<T extends BaseEntity> {
  /** Optional custom sort function for items */
  sortFn?: (a: T, b: T) => number;
}

/**
 * Create a store with single selection capability
 *
 * @example
 * const useTopicStore = createSingleSelectStore<TopicWithCount>({
 *   sortFn: (a, b) => {
 *     if (a.isPredefined && !b.isPredefined) return -1;
 *     if (!a.isPredefined && b.isPredefined) return 1;
 *     return a.name.localeCompare(b.name);
 *   }
 * });
 */
export function createSingleSelectStore<T extends BaseEntity>(options: StoreOptions<T> = {}) {
  const { sortFn } = options;

  return create<SingleSelectState<T>>((set, get) => ({
    items: [],
    selectedId: null,
    loading: false,
    error: null,

    setItems: (items) => set({ items }),

    addItem: (item) =>
      set((state) => {
        const newItems = [...state.items, item];
        return { items: sortFn ? newItems.sort(sortFn) : newItems };
      }),

    updateItem: (id, updates) =>
      set((state) => ({
        items: state.items.map((item) => (item.id === id ? { ...item, ...updates } : item)),
      })),

    deleteItem: (id) =>
      set((state) => ({
        items: state.items.filter((item) => item.id !== id),
        selectedId: state.selectedId === id ? null : state.selectedId,
      })),

    selectItem: (id) => set({ selectedId: id }),

    setLoading: (loading) => set({ loading }),

    setError: (error) => set({ error }),

    getItemById: (id) => {
      return get().items.find((item) => item.id === id) || null;
    },
  }));
}

/**
 * Create a store with multi-selection capability
 *
 * @example
 * const useTagStore = createMultiSelectStore<TagWithCount>({
 *   sortFn: (a, b) => a.name.localeCompare(b.name)
 * });
 */
export function createMultiSelectStore<T extends BaseEntity>(options: StoreOptions<T> = {}) {
  const { sortFn } = options;

  return create<MultiSelectState<T>>((set, get) => ({
    items: [],
    selectedIds: [],
    loading: false,
    error: null,

    setItems: (items) => set({ items }),

    addItem: (item) =>
      set((state) => {
        const newItems = [...state.items, item];
        return { items: sortFn ? newItems.sort(sortFn) : newItems };
      }),

    updateItem: (id, updates) =>
      set((state) => ({
        items: state.items.map((item) => (item.id === id ? { ...item, ...updates } : item)),
      })),

    deleteItem: (id) =>
      set((state) => ({
        items: state.items.filter((item) => item.id !== id),
        selectedIds: state.selectedIds.filter((selectedId) => selectedId !== id),
      })),

    selectItem: (id) =>
      set((state) => ({
        selectedIds: state.selectedIds.includes(id)
          ? state.selectedIds
          : [...state.selectedIds, id],
      })),

    deselectItem: (id) =>
      set((state) => ({
        selectedIds: state.selectedIds.filter((selectedId) => selectedId !== id),
      })),

    toggleItem: (id) =>
      set((state) => ({
        selectedIds: state.selectedIds.includes(id)
          ? state.selectedIds.filter((selectedId) => selectedId !== id)
          : [...state.selectedIds, id],
      })),

    clearSelection: () => set({ selectedIds: [] }),

    setLoading: (loading) => set({ loading }),

    setError: (error) => set({ error }),

    getSelectedItems: () => {
      const state = get();
      return state.items.filter((item) => state.selectedIds.includes(item.id));
    },

    getItemById: (id) => {
      return get().items.find((item) => item.id === id) || null;
    },
  }));
}

/**
 * Helper type to extract store state from a created store
 */
export type StoreState<T> = T extends { getState: () => infer S } ? S : never;
