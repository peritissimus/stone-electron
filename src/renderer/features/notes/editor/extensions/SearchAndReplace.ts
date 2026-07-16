/**
 * Search and Replace Extension for TipTap
 * Provides find/replace functionality with highlight decorations
 */

import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

export interface SearchAndReplaceOptions {
  searchTerm: string;
  replaceTerm: string;
  caseSensitive: boolean;
  highlightClass: string;
  activeHighlightClass: string;
}

export interface SearchAndReplaceStorage {
  searchTerm: string;
  replaceTerm: string;
  caseSensitive: boolean;
  results: { from: number; to: number }[];
  currentIndex: number;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    searchAndReplace: {
      setSearchTerm: (searchTerm: string) => ReturnType;
      setReplaceTerm: (replaceTerm: string) => ReturnType;
      setCaseSensitive: (caseSensitive: boolean) => ReturnType;
      findNext: () => ReturnType;
      findPrevious: () => ReturnType;
      replaceCurrent: () => ReturnType;
      replaceAll: () => ReturnType;
      clearSearch: () => ReturnType;
    };
  }
}

const searchAndReplacePluginKey = new PluginKey('searchAndReplace');

function findMatches(
  doc: any,
  searchTerm: string,
  caseSensitive: boolean,
): { from: number; to: number }[] {
  const results: { from: number; to: number }[] = [];

  if (!searchTerm) return results;

  const searchRegex = caseSensitive
    ? new RegExp(escapeRegex(searchTerm), 'g')
    : new RegExp(escapeRegex(searchTerm), 'gi');

  doc.descendants((node: any, pos: number) => {
    if (!node.isText) return;

    const text = node.text || '';
    let match;

    while ((match = searchRegex.exec(text)) !== null) {
      results.push({
        from: pos + match.index,
        to: pos + match.index + match[0].length,
      });
    }
  });

  return results;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export const SearchAndReplace = Extension.create<SearchAndReplaceOptions, SearchAndReplaceStorage>({
  name: 'searchAndReplace',

  addOptions() {
    return {
      searchTerm: '',
      replaceTerm: '',
      caseSensitive: false,
      highlightClass: 'search-highlight',
      activeHighlightClass: 'search-highlight-active',
    };
  },

  addStorage() {
    return {
      searchTerm: '',
      replaceTerm: '',
      caseSensitive: false,
      results: [],
      currentIndex: 0,
    };
  },

  addCommands() {
    return {
      setSearchTerm:
        (searchTerm: string) =>
        ({ editor, dispatch }) => {
          this.storage.searchTerm = searchTerm;
          this.storage.results = findMatches(
            editor.state.doc,
            searchTerm,
            this.storage.caseSensitive,
          );
          this.storage.currentIndex = this.storage.results.length > 0 ? 0 : -1;

          if (dispatch) {
            // Force view update
            editor.view.dispatch(editor.state.tr);
          }

          return true;
        },

      setReplaceTerm: (replaceTerm: string) => () => {
        this.storage.replaceTerm = replaceTerm;
        return true;
      },

      setCaseSensitive:
        (caseSensitive: boolean) =>
        ({ editor, dispatch }) => {
          this.storage.caseSensitive = caseSensitive;
          this.storage.results = findMatches(
            editor.state.doc,
            this.storage.searchTerm,
            caseSensitive,
          );
          this.storage.currentIndex = this.storage.results.length > 0 ? 0 : -1;

          if (dispatch) {
            editor.view.dispatch(editor.state.tr);
          }

          return true;
        },

      findNext:
        () =>
        ({ editor }) => {
          const { results, currentIndex } = this.storage;
          if (results.length === 0) return false;

          const nextIndex = (currentIndex + 1) % results.length;
          this.storage.currentIndex = nextIndex;

          const match = results[nextIndex];
          editor.commands.setTextSelection({ from: match.from, to: match.to });

          // Scroll into view
          const { node } = editor.view.domAtPos(match.from);
          (node as Element)?.scrollIntoView?.({ block: 'center', behavior: 'smooth' });

          editor.view.dispatch(editor.state.tr);

          return true;
        },

      findPrevious:
        () =>
        ({ editor }) => {
          const { results, currentIndex } = this.storage;
          if (results.length === 0) return false;

          const prevIndex = currentIndex <= 0 ? results.length - 1 : currentIndex - 1;
          this.storage.currentIndex = prevIndex;

          const match = results[prevIndex];
          editor.commands.setTextSelection({ from: match.from, to: match.to });

          // Scroll into view
          const { node } = editor.view.domAtPos(match.from);
          (node as Element)?.scrollIntoView?.({ block: 'center', behavior: 'smooth' });

          editor.view.dispatch(editor.state.tr);

          return true;
        },

      replaceCurrent:
        () =>
        ({ editor, chain }) => {
          const { results, currentIndex, replaceTerm } = this.storage;
          if (results.length === 0 || currentIndex < 0) return false;

          const match = results[currentIndex];

          chain()
            .setTextSelection({ from: match.from, to: match.to })
            .deleteSelection()
            .insertContent(replaceTerm)
            .run();

          // Refresh results after replacement
          this.storage.results = findMatches(
            editor.state.doc,
            this.storage.searchTerm,
            this.storage.caseSensitive,
          );

          // Adjust current index
          if (this.storage.results.length === 0) {
            this.storage.currentIndex = -1;
          } else if (currentIndex >= this.storage.results.length) {
            this.storage.currentIndex = 0;
          }

          editor.view.dispatch(editor.state.tr);

          return true;
        },

      replaceAll:
        () =>
        ({ editor, chain }) => {
          const { results, replaceTerm } = this.storage;
          if (results.length === 0) return false;

          // Replace from end to start to preserve positions
          const sortedResults = [...results].sort((a, b) => b.from - a.from);

          let chainedCommands = chain();
          for (const match of sortedResults) {
            chainedCommands = chainedCommands
              .setTextSelection({ from: match.from, to: match.to })
              .deleteSelection()
              .insertContent(replaceTerm);
          }
          chainedCommands.run();

          // Clear results after replace all
          this.storage.results = [];
          this.storage.currentIndex = -1;

          editor.view.dispatch(editor.state.tr);

          return true;
        },

      clearSearch:
        () =>
        ({ editor }) => {
          this.storage.searchTerm = '';
          this.storage.replaceTerm = '';
          this.storage.results = [];
          this.storage.currentIndex = -1;

          editor.view.dispatch(editor.state.tr);

          return true;
        },
    };
  },

  addProseMirrorPlugins() {
    const { highlightClass, activeHighlightClass } = this.options;
    const storage = this.storage;

    return [
      new Plugin({
        key: searchAndReplacePluginKey,
        state: {
          init() {
            return DecorationSet.empty;
          },
          apply(tr, _oldSet) {
            const { results, currentIndex } = storage;

            if (results.length === 0) {
              return DecorationSet.empty;
            }

            const decorations = results.map((match, index) => {
              const isActive = index === currentIndex;
              return Decoration.inline(match.from, match.to, {
                class: isActive ? activeHighlightClass : highlightClass,
              });
            });

            return DecorationSet.create(tr.doc, decorations);
          },
        },
        props: {
          decorations(state) {
            return this.getState(state);
          },
        },
      }),
    ];
  },
});

export default SearchAndReplace;
