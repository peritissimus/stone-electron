/** Settings command payloads decoded at the main-process IPC edge. */
import { z } from './schema';

export const SettingKeyRequestSchema = z.object({ key: z.string() }).strict();
export const SetSettingRequestSchema = z.object({ key: z.string(), value: z.string() }).strict();
export const SetThemeRequestSchema = z
  .object({ theme: z.literalEnum(['light', 'dark', 'system']) })
  .strict();
export const SetAccentColorRequestSchema = z
  .object({
    accentColor: z.literalEnum(['blue', 'purple', 'pink', 'red', 'orange', 'green', 'teal']),
  })
  .strict();
export const UpdateFontSettingsRequestSchema = z
  .object({
    fontSettings: z
      .object({
        uiFont: z.string().optional(),
        uiFontSize: z.number().optional(),
        editorHeadingFont: z.string().optional(),
        editorBodyFont: z.string().optional(),
        editorFontSize: z.number().optional(),
        editorLineHeight: z.number().optional(),
        monoFont: z.string().optional(),
        monoFontSize: z.number().optional(),
      })
      .strict(),
  })
  .strict();

const stringArray = z.array(z.string());
export const UpdateEditorRequestSchema = z
  .object({
    editor: z
      .object({
        behavior: z
          .object({
            placeholder: z.string(),
            defaultMode: z.literalEnum(['rich', 'raw']),
          })
          .strict()
          .optional(),
        indent: z
          .object({ types: stringArray, maxIndent: z.number().int().nonnegative() })
          .strict()
          .optional(),
        table: z
          .object({ resizable: z.boolean(), allowNodeSelection: z.boolean() })
          .strict()
          .optional(),
        task: z
          .object({
            states: z.array(
              z.object({
                value: z.string(),
                label: z.string(),
                shortLabel: z.string().optional(),
                done: z.boolean().optional(),
              }),
            ),
            defaultState: z.string(),
            doneStates: stringArray,
            nested: z.boolean(),
          })
          .strict()
          .optional(),
        codeBlock: z.object({ preloadLanguages: stringArray }).strict().optional(),
      })
      .strict(),
  })
  .strict();

const ShortcutScopeSchema = z.literalEnum(['app', 'editor']);
export const SetShortcutRequestSchema = z
  .object({
    scope: ShortcutScopeSchema,
    action: z.string(),
    binding: z.union([z.string(), z.array(z.string())]),
  })
  .strict();
export const ResetShortcutRequestSchema = z
  .object({ scope: ShortcutScopeSchema, action: z.string() })
  .strict();

export const UpdateAIRequestSchema = z
  .object({
    ai: z
      .object({
        indexing: z
          .object({
            enabled: z.boolean(),
            providerMode: z.literalEnum(['local', 'cloud', 'disabled']),
            chunkMaxCharacters: z.number().int().positive(),
            chunkOverlapCharacters: z.number().int().nonnegative(),
            batchSize: z.number().int().positive(),
            autoIndexOnSave: z.boolean(),
          })
          .strict()
          .optional(),
        models: z
          .object({
            textModel: z.string(),
            embeddingModel: z.string(),
            openaiBaseUrl: z.string(),
          })
          .strict()
          .optional(),
        privacy: z
          .object({
            allowCloudInference: z.boolean(),
            allowSendingNoteContent: z.boolean(),
            allowSendingMetadata: z.boolean(),
          })
          .strict()
          .optional(),
      })
      .strict(),
  })
  .strict();

const AIProviderSchema = z.literalEnum(['openai', 'azure', 'google', 'groq']);
export const SetAIProviderKeyRequestSchema = z
  .object({ provider: AIProviderSchema, apiKey: z.string() })
  .strict();
export const DeleteAIProviderKeyRequestSchema = z.object({ provider: AIProviderSchema }).strict();
export const UpdateMeetingsRequestSchema = z
  .object({ meetings: z.object({ audioRetentionDays: z.number().int().optional() }).strict() })
  .strict();
export const UpdateIntegrationsRequestSchema = z
  .object({
    integrations: z
      .object({
        linearApiKey: z.string().optional(),
        selectedCalendarIds: z.array(z.string()).nullable().optional(),
      })
      .strict(),
  })
  .strict();
export const UpdateOnboardingRequestSchema = z
  .object({
    onboarding: z
      .object({
        completed: z.boolean().optional(),
        steps: z
          .object({
            workspace: z.boolean().optional(),
            permissions: z.boolean().optional(),
            ai: z.boolean().optional(),
            models: z.boolean().optional(),
            shortcuts: z.boolean().optional(),
          })
          .strict()
          .optional(),
      })
      .strict(),
  })
  .strict();
export const SetQuickCaptureShortcutRequestSchema = z
  .object({ shortcut: z.string() })
  .strict();
