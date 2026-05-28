import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Check, Cloud, Cpu, FloppyDisk, Key, Trash } from 'phosphor-react';
import { useAISettings } from '@renderer/hooks/useAISettings';
import { Badge } from '@renderer/components/base/ui/badge';
import { Button } from '@renderer/components/base/ui/button';
import { Input } from '@renderer/components/base/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@renderer/components/base/ui/select';
import { Switch } from '@renderer/components/base/ui/switch';
import { Label, Body } from '@renderer/components/base/ui/text';
import { ContainerStack, Separator } from '@renderer/components/base/ui';
import type { AIModelConfig, AIProviderId, AIProviderKeyStatus } from '@shared/types/settings';
import { Message } from './Message';
import { SettingsSection } from './SettingsSection';

type MessageState = { type: 'success' | 'error'; text: string } | null;

function SettingRow({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-md border border-border/70 px-3 py-3">
      <div className="min-w-0">
        <Body size="sm" weight="medium">
          {title}
        </Body>
        {description && (
          <Body size="xs" variant="muted" className="mt-0.5 text-pretty">
            {description}
          </Body>
        )}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function NumberInput({
  value,
  min,
  max,
  disabled,
  onChange,
}: {
  value: number;
  min: number;
  max?: number;
  disabled?: boolean;
  onChange: (value: number) => void;
}) {
  return (
    <Input
      type="number"
      min={min}
      max={max}
      value={value}
      disabled={disabled}
      className="w-28 tabular-nums"
      onChange={(event) => {
        const next = Number(event.target.value);
        if (!Number.isFinite(next)) return;
        onChange(max === undefined ? Math.max(min, next) : Math.min(max, Math.max(min, next)));
      }}
    />
  );
}

export function AISettings() {
  const {
    ai,
    providerKeys,
    loaded,
    keysLoaded,
    saving,
    error,
    updateIndexing,
    updateModels,
    updatePrivacy,
    setProviderKey,
    deleteProviderKey,
  } = useAISettings();
  const [message, setMessage] = useState<MessageState>(null);
  const [modelDraft, setModelDraft] = useState<AIModelConfig>(ai.models);
  const [keyDrafts, setKeyDrafts] = useState<Partial<Record<AIProviderId, string>>>({});

  useEffect(() => {
    setModelDraft(ai.models);
  }, [ai.models]);

  const run = async (action: () => Promise<void>, success: string) => {
    setMessage(null);
    try {
      await action();
      setMessage({ type: 'success', text: success });
    } catch (err) {
      setMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Failed to update AI settings',
      });
    }
  };

  const saveModels = () =>
    run(async () => updateModels(modelDraft), 'AI model settings saved');

  const saveProviderKey = (provider: AIProviderId, label: string) =>
    run(async () => {
      await setProviderKey(provider, keyDrafts[provider] ?? '');
      setKeyDrafts((drafts) => ({ ...drafts, [provider]: '' }));
    }, `${label} key saved`);

  const removeProviderKey = (provider: AIProviderId, label: string) =>
    run(async () => {
      await deleteProviderKey(provider);
      setKeyDrafts((drafts) => ({ ...drafts, [provider]: '' }));
    }, `${label} stored key removed`);

  const cloudEnabled = ai.privacy.allowCloudInference;
  const indexDisabled = saving || !loaded;

  return (
    <SettingsSection
      title="AI"
      description="Configure local and cloud models for indexing, ranking, and answering questions about your notes."
    >
      <ContainerStack gap="lg">
        {!loaded && <Body variant="muted">Loading AI settings...</Body>}
        {error && <Message type="error" text={error} />}
        {message && <Message type={message.type} text={message.text} />}

        <ContainerStack gap="sm">
          <Label className="flex items-center gap-2">
            <Cloud size={14} />
            Privacy
          </Label>
          <SettingRow
            title="Cloud inference"
            description="Allow configured cloud models to process AI requests"
          >
            <Switch
              checked={cloudEnabled}
              disabled={saving}
              onCheckedChange={(checked) =>
                void run(
                  async () => updatePrivacy({ allowCloudInference: checked }),
                  checked ? 'Cloud inference enabled' : 'Cloud inference disabled',
                )
              }
            />
          </SettingRow>
          <SettingRow
            title="Send note content"
            description="Required for cloud summaries, answers, embeddings, and reranking"
          >
            <Switch
              checked={ai.privacy.allowSendingNoteContent}
              disabled={saving || !cloudEnabled}
              onCheckedChange={(checked) =>
                void run(
                  async () => updatePrivacy({ allowSendingNoteContent: checked }),
                  checked ? 'Note content sharing enabled' : 'Note content sharing disabled',
                )
              }
            />
          </SettingRow>
          <SettingRow
            title="Send metadata"
            description="Include titles and headings with cloud requests"
          >
            <Switch
              checked={ai.privacy.allowSendingMetadata}
              disabled={saving || !cloudEnabled}
              onCheckedChange={(checked) =>
                void run(
                  async () => updatePrivacy({ allowSendingMetadata: checked }),
                  checked ? 'Metadata sharing enabled' : 'Metadata sharing disabled',
                )
              }
            />
          </SettingRow>
        </ContainerStack>

        <Separator />

        <ContainerStack gap="sm">
          <Label className="flex items-center gap-2">
            <Key size={14} />
            Provider Keys
          </Label>
          {!keysLoaded && <Body variant="muted">Detecting provider keys...</Body>}
          {providerKeys.map((providerKey) => (
            <ProviderKeyRow
              key={providerKey.provider}
              providerKey={providerKey}
              value={keyDrafts[providerKey.provider] ?? ''}
              disabled={saving}
              onChange={(value) =>
                setKeyDrafts((drafts) => ({ ...drafts, [providerKey.provider]: value }))
              }
              onSave={() => saveProviderKey(providerKey.provider, providerKey.label)}
              onDelete={() => removeProviderKey(providerKey.provider, providerKey.label)}
            />
          ))}
        </ContainerStack>

        <Separator />

        <ContainerStack gap="sm">
          <Label className="flex items-center gap-2">
            <Cpu size={14} />
            Indexing
          </Label>
          <SettingRow title="Indexing" description="Build searchable AI-ready note context">
            <Switch
              checked={ai.indexing.enabled}
              disabled={indexDisabled}
              onCheckedChange={(checked) =>
                void run(
                  async () => updateIndexing({ enabled: checked }),
                  checked ? 'AI indexing enabled' : 'AI indexing disabled',
                )
              }
            />
          </SettingRow>
          <SettingRow title="Provider mode">
            <Select
              value={ai.indexing.providerMode}
              disabled={indexDisabled}
              onValueChange={(providerMode) =>
                void run(
                  async () =>
                    updateIndexing({
                      providerMode: providerMode as typeof ai.indexing.providerMode,
                    }),
                  'AI provider mode updated',
                )
              }
            >
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="local">Local</SelectItem>
                <SelectItem value="cloud">Cloud</SelectItem>
                <SelectItem value="disabled">Disabled</SelectItem>
              </SelectContent>
            </Select>
          </SettingRow>
          <SettingRow title="Auto-index on save">
            <Switch
              checked={ai.indexing.autoIndexOnSave}
              disabled={indexDisabled}
              onCheckedChange={(checked) =>
                void run(
                  async () => updateIndexing({ autoIndexOnSave: checked }),
                  checked ? 'Auto-indexing enabled' : 'Auto-indexing disabled',
                )
              }
            />
          </SettingRow>
          <SettingRow title="Chunk size">
            <NumberInput
              value={ai.indexing.chunkMaxCharacters}
              min={200}
              disabled={indexDisabled}
              onChange={(chunkMaxCharacters) =>
                void run(
                  async () => updateIndexing({ chunkMaxCharacters }),
                  'AI chunk size updated',
                )
              }
            />
          </SettingRow>
          <SettingRow title="Chunk overlap">
            <NumberInput
              value={ai.indexing.chunkOverlapCharacters}
              min={0}
              max={ai.indexing.chunkMaxCharacters - 1}
              disabled={indexDisabled}
              onChange={(chunkOverlapCharacters) =>
                void run(
                  async () => updateIndexing({ chunkOverlapCharacters }),
                  'AI chunk overlap updated',
                )
              }
            />
          </SettingRow>
          <SettingRow title="Batch size">
            <NumberInput
              value={ai.indexing.batchSize}
              min={1}
              disabled={indexDisabled}
              onChange={(batchSize) =>
                void run(async () => updateIndexing({ batchSize }), 'AI batch size updated')
              }
            />
          </SettingRow>
        </ContainerStack>

        <Separator />

        <ContainerStack gap="sm">
          <Label>Models</Label>
          <ContainerStack gap="sm">
            <div className="grid grid-cols-[140px_1fr] items-center gap-3">
              <Body size="sm" variant="muted">
                Text
              </Body>
              <Input
                value={modelDraft.textModel}
                disabled={saving}
                onChange={(event) =>
                  setModelDraft((draft) => ({ ...draft, textModel: event.target.value }))
                }
              />
            </div>
            <div className="grid grid-cols-[140px_1fr] items-center gap-3">
              <Body size="sm" variant="muted">
                Embeddings
              </Body>
              <Input
                value={modelDraft.embeddingModel}
                disabled={saving}
                onChange={(event) =>
                  setModelDraft((draft) => ({ ...draft, embeddingModel: event.target.value }))
                }
              />
            </div>
            <div className="grid grid-cols-[140px_1fr] items-center gap-3">
              <Body size="sm" variant="muted">
                Rerank
              </Body>
              <Input
                value={modelDraft.rerankModel}
                disabled={saving}
                onChange={(event) =>
                  setModelDraft((draft) => ({ ...draft, rerankModel: event.target.value }))
                }
              />
            </div>
          </ContainerStack>
          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              onClick={() => setModelDraft(ai.models)}
              disabled={saving || JSON.stringify(modelDraft) === JSON.stringify(ai.models)}
            >
              <Check size={14} />
              Revert
            </Button>
            <Button
              onClick={saveModels}
              disabled={saving || JSON.stringify(modelDraft) === JSON.stringify(ai.models)}
            >
              <FloppyDisk size={14} />
              Save Models
            </Button>
          </div>
        </ContainerStack>
      </ContainerStack>
    </SettingsSection>
  );
}

function ProviderKeyRow({
  providerKey,
  value,
  disabled,
  onChange,
  onSave,
  onDelete,
}: {
  providerKey: AIProviderKeyStatus;
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
  onSave: () => void;
  onDelete: () => void;
}) {
  const badge = providerKey.activeSource
    ? providerKey.activeSource === 'stored'
      ? 'Stored'
      : 'Env'
    : 'Missing';

  return (
    <div className="rounded-md border border-border/70 px-3 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Body size="sm" weight="medium">
              {providerKey.label}
            </Body>
            <Badge variant={providerKey.available ? 'secondary' : 'outline'}>{badge}</Badge>
          </div>
          <Body size="xs" variant="muted" className="mt-1">
            Env: {providerKey.envVar}
          </Body>
        </div>
        {providerKey.hasStoredKey && (
          <Button variant="ghost" size="sm" onClick={onDelete} disabled={disabled}>
            <Trash size={14} />
            Remove
          </Button>
        )}
      </div>

      <div className="mt-3 flex gap-2">
        <Input
          type="password"
          value={value}
          disabled={disabled}
          placeholder={providerKey.hasStoredKey ? 'Stored key configured' : 'Paste API key'}
          onChange={(event) => onChange(event.target.value)}
        />
        <Button onClick={onSave} disabled={disabled || value.trim().length === 0}>
          <FloppyDisk size={14} />
          Save
        </Button>
      </div>
      {providerKey.hasEnvKey && providerKey.hasStoredKey && (
        <Body size="xs" variant="muted" className="mt-2">
          Stored key takes precedence over the environment variable.
        </Body>
      )}
    </div>
  );
}
