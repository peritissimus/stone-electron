/**
 * Self-healing AppConfig normalization tests.
 *
 * Pure module — no I/O, no mocks needed. Drives the contract that a
 * partially-corrupt config.json must always degrade gracefully to a
 * fully-typed AppConfig with defaults filled in.
 */

import { describe, it, expect } from 'vitest';
import {
  normalizeConfig,
  mergeAppearance,
  mergeAI,
  mergeEditor,
  mergeNotes,
  mergeShortcuts,
} from '../../../../src/main/adapters/out/persistence/appConfigNormalize';
import { DEFAULT_APP_CONFIG } from '../../../../src/shared/types/settings';

describe('normalizeConfig', () => {
  it('returns full defaults for non-object input', () => {
    expect(normalizeConfig(null)).toEqual(DEFAULT_APP_CONFIG);
    expect(normalizeConfig(undefined)).toEqual(DEFAULT_APP_CONFIG);
    expect(normalizeConfig('garbage')).toEqual(DEFAULT_APP_CONFIG);
    expect(normalizeConfig(42)).toEqual(DEFAULT_APP_CONFIG);
    expect(normalizeConfig([])).toEqual(DEFAULT_APP_CONFIG);
  });

  it('returns full defaults for empty object', () => {
    expect(normalizeConfig({})).toEqual(DEFAULT_APP_CONFIG);
  });

  it('preserves a fully-valid config (round-trip)', () => {
    const result = normalizeConfig(DEFAULT_APP_CONFIG);
    expect(result).toEqual(DEFAULT_APP_CONFIG);
  });

  it('fills in missing editor and shortcuts when only legacy fields present', () => {
    const legacy = {
      appearance: DEFAULT_APP_CONFIG.appearance,
      workspace: { defaultWorkspacePath: 'CustomFolder' },
    };
    const result = normalizeConfig(legacy);
    expect(result.editor).toEqual(DEFAULT_APP_CONFIG.editor);
    expect(result.shortcuts).toEqual(DEFAULT_APP_CONFIG.shortcuts);
    expect(result.workspace.defaultWorkspacePath).toBe('CustomFolder');
  });

  it('preserves a custom workspace path', () => {
    const result = normalizeConfig({ workspace: { defaultWorkspacePath: 'MyNotes' } });
    expect(result.workspace.defaultWorkspacePath).toBe('MyNotes');
  });

  it('falls back to default workspace path when blank', () => {
    const result = normalizeConfig({ workspace: { defaultWorkspacePath: '   ' } });
    expect(result.workspace.defaultWorkspacePath).toBe(
      DEFAULT_APP_CONFIG.workspace.defaultWorkspacePath,
    );
  });

  it('returns a serializable AppConfig (round-trips through JSON)', () => {
    const result = normalizeConfig(DEFAULT_APP_CONFIG);
    const json = JSON.stringify(result);
    const parsed = JSON.parse(json);
    expect(normalizeConfig(parsed)).toEqual(result);
  });
});

describe('mergeAppearance', () => {
  it('uses defaults for non-object input', () => {
    expect(mergeAppearance(null)).toEqual(DEFAULT_APP_CONFIG.appearance);
    expect(mergeAppearance('dark')).toEqual(DEFAULT_APP_CONFIG.appearance);
  });

  it('preserves valid theme + accent + fonts', () => {
    const result = mergeAppearance({
      theme: 'dark',
      accentColor: 'purple',
      fontSettings: DEFAULT_APP_CONFIG.appearance.fontSettings,
    });
    expect(result.theme).toBe('dark');
    expect(result.accentColor).toBe('purple');
  });

  it('falls back on invalid theme', () => {
    const result = mergeAppearance({ theme: 'gradient' });
    expect(result.theme).toBe(DEFAULT_APP_CONFIG.appearance.theme);
  });

  it('falls back on invalid accent', () => {
    const result = mergeAppearance({ accentColor: 'chartreuse' });
    expect(result.accentColor).toBe(DEFAULT_APP_CONFIG.appearance.accentColor);
  });

  it('merges partial font settings with defaults', () => {
    const result = mergeAppearance({ fontSettings: { uiFontSize: 18 } });
    expect(result.fontSettings.uiFontSize).toBe(18);
    expect(result.fontSettings.editorFontSize).toBe(
      DEFAULT_APP_CONFIG.appearance.fontSettings.editorFontSize,
    );
  });
});

describe('mergeEditor', () => {
  it('uses defaults for non-object input', () => {
    expect(mergeEditor(null)).toEqual(DEFAULT_APP_CONFIG.editor);
    expect(mergeEditor('garbage')).toEqual(DEFAULT_APP_CONFIG.editor);
  });

  it('preserves a fully-valid editor config', () => {
    const result = mergeEditor(DEFAULT_APP_CONFIG.editor);
    expect(result).toEqual(DEFAULT_APP_CONFIG.editor);
  });

  it('preserves a custom placeholder', () => {
    const result = mergeEditor({ behavior: { placeholder: 'Hello world' } });
    expect(result.behavior.placeholder).toBe('Hello world');
    expect(result.behavior.defaultMode).toBe(DEFAULT_APP_CONFIG.editor.behavior.defaultMode);
  });

  it('preserves valid defaultMode', () => {
    const result = mergeEditor({ behavior: { defaultMode: 'raw' } });
    expect(result.behavior.defaultMode).toBe('raw');
  });

  it('falls back on invalid defaultMode', () => {
    const result = mergeEditor({ behavior: { defaultMode: 'wysiwyg' } });
    expect(result.behavior.defaultMode).toBe(DEFAULT_APP_CONFIG.editor.behavior.defaultMode);
  });

  it('preserves valid indent config', () => {
    const result = mergeEditor({ indent: { types: ['paragraph'], maxIndent: 4 } });
    expect(result.indent.types).toEqual(['paragraph']);
    expect(result.indent.maxIndent).toBe(4);
  });

  it('falls back on invalid maxIndent (negative)', () => {
    const result = mergeEditor({ indent: { maxIndent: -1 } });
    expect(result.indent.maxIndent).toBe(DEFAULT_APP_CONFIG.editor.indent.maxIndent);
  });

  it('falls back on non-integer maxIndent', () => {
    const result = mergeEditor({ indent: { maxIndent: 3.5 } });
    expect(result.indent.maxIndent).toBe(DEFAULT_APP_CONFIG.editor.indent.maxIndent);
  });

  it('drops invalid task state entries', () => {
    const result = mergeEditor({
      task: {
        states: [
          { value: 'todo', label: 'TODO' },
          { value: '', label: 'INVALID' }, // empty value
          'garbage',
          { value: 'done', label: 'DONE', done: true },
        ],
        defaultState: 'todo',
        doneStates: ['done'],
      },
    });
    expect(result.task.states.map((s) => s.value)).toEqual(['todo', 'done']);
  });

  it('falls back to default task states when all entries invalid', () => {
    const result = mergeEditor({
      task: { states: ['garbage', null, { invalid: true }] },
    });
    expect(result.task.states).toEqual(DEFAULT_APP_CONFIG.editor.task.states);
  });

  it('drops doneStates referencing unknown task values', () => {
    const result = mergeEditor({
      task: {
        states: [{ value: 'todo', label: 'TODO' }],
        defaultState: 'todo',
        doneStates: ['done', 'unknownState', 'todo'],
      },
    });
    expect(result.task.doneStates).toEqual(['todo']);
  });

  it('reassigns defaultState if it references an unknown value', () => {
    const result = mergeEditor({
      task: {
        states: [{ value: 'a', label: 'A' }],
        defaultState: 'doesNotExist',
      },
    });
    expect(result.task.defaultState).toBe('a');
  });

  it('preserves valid table config', () => {
    const result = mergeEditor({ table: { resizable: true, allowNodeSelection: false } });
    expect(result.table.resizable).toBe(true);
    expect(result.table.allowNodeSelection).toBe(false);
  });

  it('preserves codeBlock preload list', () => {
    const result = mergeEditor({ codeBlock: { preloadLanguages: ['rust', 'go'] } });
    expect(result.codeBlock.preloadLanguages).toEqual(['rust', 'go']);
  });

  it('falls back when preloadLanguages is not a string array', () => {
    const result = mergeEditor({ codeBlock: { preloadLanguages: [1, 2, 3] } });
    expect(result.codeBlock.preloadLanguages).toEqual(
      DEFAULT_APP_CONFIG.editor.codeBlock.preloadLanguages,
    );
  });
});

describe('mergeShortcuts', () => {
  it('returns empty overrides for non-object input', () => {
    expect(mergeShortcuts(null)).toEqual({ app: {}, editor: {} });
    expect(mergeShortcuts('garbage')).toEqual({ app: {}, editor: {} });
  });

  it('preserves valid single-chord overrides', () => {
    const result = mergeShortcuts({
      app: { save: 'Mod-Alt-s' },
      editor: { indent: 'Tab' },
    });
    expect(result.app.save).toBe('Mod-Alt-s');
    expect(result.editor.indent).toBe('Tab');
  });

  it('preserves valid multi-chord overrides', () => {
    const result = mergeShortcuts({
      app: { save: ['Mod-s', 'Mod-Alt-s'] },
      editor: {},
    });
    expect(result.app.save).toEqual(['Mod-s', 'Mod-Alt-s']);
  });

  it('drops unknown action keys', () => {
    const result = mergeShortcuts({
      app: { save: 'Mod-s', notARealAction: 'Mod-x' },
      editor: { indent: 'Tab', alsoFake: 'Tab' },
    });
    expect(result.app).toEqual({ save: 'Mod-s' });
    expect(result.editor).toEqual({ indent: 'Tab' });
  });

  it('drops invalid chord strings', () => {
    const result = mergeShortcuts({
      app: { save: 'NotAChord' },
      editor: {},
    });
    expect(result.app.save).toBeUndefined();
  });

  it('drops invalid chords from multi-chord arrays but keeps valid ones', () => {
    const result = mergeShortcuts({
      app: { save: ['Mod-s', 'garbage', 'Mod-Alt-s'] },
      editor: {},
    });
    expect(result.app.save).toEqual(['Mod-s', 'Mod-Alt-s']);
  });

  it('drops a binding entirely when its array contains no valid chords', () => {
    const result = mergeShortcuts({
      app: { save: ['garbage', 'alsoBad'] },
      editor: {},
    });
    expect(result.app.save).toBeUndefined();
  });

  it('drops a binding when value is neither string nor array', () => {
    const result = mergeShortcuts({
      app: { save: 42 },
      editor: { indent: { not: 'a chord' } },
    });
    expect(result.app.save).toBeUndefined();
    expect(result.editor.indent).toBeUndefined();
  });

  it('returns empty when app/editor are missing', () => {
    const result = mergeShortcuts({});
    expect(result).toEqual({ app: {}, editor: {} });
  });

  it('handles app/editor being non-objects', () => {
    const result = mergeShortcuts({ app: 'garbage', editor: null });
    expect(result).toEqual({ app: {}, editor: {} });
  });
});

describe('mergeNotes', () => {
  it('returns defaults for non-object input', () => {
    expect(mergeNotes(undefined)).toEqual(DEFAULT_APP_CONFIG.notes);
    expect(mergeNotes(null)).toEqual(DEFAULT_APP_CONFIG.notes);
    expect(mergeNotes(42)).toEqual(DEFAULT_APP_CONFIG.notes);
    expect(mergeNotes([])).toEqual(DEFAULT_APP_CONFIG.notes);
  });

  it('preserves valid custom folder names', () => {
    const result = mergeNotes({
      locationPolicy: {
        journalFolder: 'Daily',
        defaultNoteFolder: 'Inbox',
        quickNoteSlotFolders: { personal: 'Me', work: 'Office' },
      },
    });
    expect(result.locationPolicy).toEqual({
      journalFolder: 'Daily',
      defaultNoteFolder: 'Inbox',
      quickNoteSlotFolders: { personal: 'Me', work: 'Office' },
    });
  });

  it('trims leading/trailing slashes from folder names', () => {
    const result = mergeNotes({
      locationPolicy: {
        journalFolder: '/Daily/',
        defaultNoteFolder: '//Inbox///',
        quickNoteSlotFolders: { personal: '/Me/', work: 'Office' },
      },
    });
    expect(result.locationPolicy.journalFolder).toBe('Daily');
    expect(result.locationPolicy.defaultNoteFolder).toBe('Inbox');
    expect(result.locationPolicy.quickNoteSlotFolders.personal).toBe('Me');
  });

  it('falls back to defaults for empty / whitespace folder names', () => {
    const result = mergeNotes({
      locationPolicy: {
        journalFolder: '',
        defaultNoteFolder: '   ',
        quickNoteSlotFolders: { personal: '', work: '   ' },
      },
    });
    expect(result.locationPolicy.journalFolder).toBe(
      DEFAULT_APP_CONFIG.notes.locationPolicy.journalFolder,
    );
    expect(result.locationPolicy.defaultNoteFolder).toBe(
      DEFAULT_APP_CONFIG.notes.locationPolicy.defaultNoteFolder,
    );
    expect(result.locationPolicy.quickNoteSlotFolders).toEqual(
      DEFAULT_APP_CONFIG.notes.locationPolicy.quickNoteSlotFolders,
    );
  });

  it('fills in partial location policy with defaults', () => {
    const result = mergeNotes({
      locationPolicy: {
        journalFolder: 'Daily',
      },
    });
    expect(result.locationPolicy.journalFolder).toBe('Daily');
    expect(result.locationPolicy.defaultNoteFolder).toBe(
      DEFAULT_APP_CONFIG.notes.locationPolicy.defaultNoteFolder,
    );
    expect(result.locationPolicy.quickNoteSlotFolders).toEqual(
      DEFAULT_APP_CONFIG.notes.locationPolicy.quickNoteSlotFolders,
    );
  });

  it('survives a non-object locationPolicy', () => {
    const result = mergeNotes({ locationPolicy: 'garbage' });
    expect(result).toEqual(DEFAULT_APP_CONFIG.notes);
  });

  it('merges as part of a full normalizeConfig round-trip', () => {
    const corrupt = {
      notes: {
        locationPolicy: {
          journalFolder: 'Journals',
          quickNoteSlotFolders: { personal: '/Quick/', work: '' },
        },
      },
    };
    const result = normalizeConfig(corrupt);
    expect(result.notes.locationPolicy.journalFolder).toBe('Journals');
    expect(result.notes.locationPolicy.defaultNoteFolder).toBe(
      DEFAULT_APP_CONFIG.notes.locationPolicy.defaultNoteFolder,
    );
    expect(result.notes.locationPolicy.quickNoteSlotFolders.personal).toBe('Quick');
    expect(result.notes.locationPolicy.quickNoteSlotFolders.work).toBe(
      DEFAULT_APP_CONFIG.notes.locationPolicy.quickNoteSlotFolders.work,
    );
  });
});

describe('mergeAI', () => {
  it('returns defaults for non-object input', () => {
    expect(mergeAI(undefined)).toEqual(DEFAULT_APP_CONFIG.ai);
    expect(mergeAI(null)).toEqual(DEFAULT_APP_CONFIG.ai);
    expect(mergeAI(42)).toEqual(DEFAULT_APP_CONFIG.ai);
    expect(mergeAI([])).toEqual(DEFAULT_APP_CONFIG.ai);
  });

  it('preserves valid custom AI settings', () => {
    const result = mergeAI({
      indexing: {
        enabled: false,
        providerMode: 'cloud',
        chunkMaxCharacters: 2400,
        chunkOverlapCharacters: 240,
        batchSize: 8,
        autoIndexOnSave: false,
      },
      models: {
        textModel: 'openai/gpt-4.1',
        embeddingModel: 'openai/text-embedding-3-large',
      },
      privacy: {
        allowCloudInference: true,
        allowSendingNoteContent: true,
        allowSendingMetadata: true,
      },
    });

    expect(result.indexing.providerMode).toBe('cloud');
    expect(result.indexing.chunkMaxCharacters).toBe(2400);
    expect(result.models.embeddingModel).toBe('openai/text-embedding-3-large');
    expect(result.privacy.allowSendingNoteContent).toBe(true);
  });

  it('forces cloud content sharing off when cloud inference is disabled', () => {
    const result = mergeAI({
      privacy: {
        allowCloudInference: false,
        allowSendingNoteContent: true,
        allowSendingMetadata: true,
      },
    });

    expect(result.privacy.allowCloudInference).toBe(false);
    expect(result.privacy.allowSendingNoteContent).toBe(false);
    expect(result.privacy.allowSendingMetadata).toBe(false);
  });

  it('falls back on invalid indexing values', () => {
    const result = mergeAI({
      indexing: {
        providerMode: 'remote',
        chunkMaxCharacters: -1,
        chunkOverlapCharacters: -1,
        batchSize: 0,
      },
    });

    expect(result.indexing.providerMode).toBe(DEFAULT_APP_CONFIG.ai.indexing.providerMode);
    expect(result.indexing.chunkMaxCharacters).toBe(
      DEFAULT_APP_CONFIG.ai.indexing.chunkMaxCharacters,
    );
    expect(result.indexing.chunkOverlapCharacters).toBe(
      DEFAULT_APP_CONFIG.ai.indexing.chunkOverlapCharacters,
    );
    expect(result.indexing.batchSize).toBe(DEFAULT_APP_CONFIG.ai.indexing.batchSize);
  });

  it('normalizes AI settings as part of full AppConfig', () => {
    const result = normalizeConfig({
      ai: {
        indexing: { providerMode: 'disabled' },
        models: { textModel: 'anthropic/claude-sonnet-4.5' },
      },
    });

    expect(result.ai.indexing.providerMode).toBe('disabled');
    expect(result.ai.models.textModel).toBe('anthropic/claude-sonnet-4.5');
    expect(result.ai.models.embeddingModel).toBe(DEFAULT_APP_CONFIG.ai.models.embeddingModel);
  });
});
