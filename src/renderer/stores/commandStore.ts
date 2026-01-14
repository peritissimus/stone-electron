import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { fuzzyMatch } from '@renderer/utils/fuzzyMatch';
import type { ReactNode } from 'react';

const RECENT_LIMIT = 5;

export interface CommandDefinition {
  id: string;
  title: string;
  subtitle?: string;
  icon: ReactNode;
  shortcut?: string;
  section?: string;
  when?: string | string[];
  run: () => void;
}

export interface CommandWithMeta extends CommandDefinition {
  score: number;
  isRecent: boolean;
}

interface CommandStoreState {
  commands: Record<string, CommandDefinition>;
  recents: string[];
  contexts: Record<string, boolean>;
  register: (commands: CommandDefinition[]) => void;
  unregister: (ids: string[]) => void;
  setContext: (key: string, value: boolean) => void;
  recordUsage: (id: string) => void;
  getVisibleCommands: (query: string) => CommandWithMeta[];
}

const matchesContext = (command: CommandDefinition, contexts: Record<string, boolean>) => {
  if (!command.when) return true;
  const conditions = Array.isArray(command.when) ? command.when : [command.when];
  return conditions.every((key) => contexts[key]);
};

const scoreCommand = (
  command: CommandDefinition,
  query: string,
  recentIndex: number,
): CommandWithMeta | null => {
  const titleScore = fuzzyMatch(query, command.title);
  const subtitleScore = command.subtitle ? fuzzyMatch(query, command.subtitle) * 0.6 : 0;
  const baseScore = Math.max(titleScore, subtitleScore);

  if (baseScore <= 0) return null;

  const recentBoost = recentIndex >= 0 ? Math.max(0, 40 - recentIndex * 6) : 0;

  return {
    ...command,
    score: baseScore + recentBoost,
    isRecent: recentIndex >= 0,
  };
};

export const useCommandStore = create<CommandStoreState>()(
  persist(
    (set, get) => ({
      commands: {},
      recents: [],
      contexts: {},

      register: (commands) =>
        set((state) => {
          const next = { ...state.commands };
          commands.forEach((command) => {
            next[command.id] = command;
          });
          return { commands: next };
        }),

      unregister: (ids) =>
        set((state) => {
          const next = { ...state.commands };
          ids.forEach((id) => delete next[id]);
          const remainingRecents = state.recents.filter((id) => next[id]);
          return { commands: next, recents: remainingRecents };
        }),

      setContext: (key, value) =>
        set((state) => ({
          contexts: { ...state.contexts, [key]: value },
        })),

      recordUsage: (id) =>
        set((state) => {
          if (!state.commands[id]) return state;
          const nextRecents = [id, ...state.recents.filter((existing) => existing !== id)];
          return { recents: nextRecents.slice(0, RECENT_LIMIT) };
        }),

      getVisibleCommands: (query) => {
        const { commands, contexts, recents } = get();
        const trimmedQuery = query.trim();

        const available = Object.values(commands).filter((command) =>
          matchesContext(command, contexts),
        );

        if (available.length === 0) return [];

        if (trimmedQuery.length === 0) {
          const recentSet = new Set(recents);
          const recentCommands: CommandWithMeta[] = recents
            .map((id, index) => {
              const command = available.find((cmd) => cmd.id === id);
              if (!command) return null;
              return { ...command, score: 200 - index * 2, isRecent: true };
            })
            .filter(Boolean) as CommandWithMeta[];

          const remaining: CommandWithMeta[] = available
            .filter((cmd) => !recentSet.has(cmd.id))
            .sort((a, b) => a.title.localeCompare(b.title))
            .map((command, index) => ({ ...command, score: 120 - index, isRecent: false }));

          return [...recentCommands, ...remaining];
        }

        const scored: CommandWithMeta[] = [];
        available.forEach((command) => {
          const recentIndex = recents.indexOf(command.id);
          const result = scoreCommand(command, trimmedQuery, recentIndex);
          if (result) scored.push(result);
        });

        return scored.sort((a, b) => b.score - a.score);
      },
    }),
    {
      name: 'command-store',
      partialize: (state) => ({ recents: state.recents }),
    },
  ),
);
