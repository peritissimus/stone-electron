export type AIProviderId = 'openai' | 'cohere' | 'anthropic' | 'google' | 'mistral';

export type AIProviderKeySource = 'env' | 'stored';

export interface AIProviderDefinition {
  id: AIProviderId;
  label: string;
  envVar: string;
}

export interface AIProviderKeyStatus {
  provider: AIProviderId;
  label: string;
  envVar: string;
  hasEnvKey: boolean;
  hasStoredKey: boolean;
  available: boolean;
  activeSource: AIProviderKeySource | null;
}

export const AI_PROVIDER_DEFINITIONS: readonly AIProviderDefinition[] = [
  { id: 'openai', label: 'OpenAI', envVar: 'OPENAI_API_KEY' },
  { id: 'cohere', label: 'Cohere', envVar: 'COHERE_API_KEY' },
  { id: 'anthropic', label: 'Anthropic', envVar: 'ANTHROPIC_API_KEY' },
  { id: 'google', label: 'Google', envVar: 'GOOGLE_GENERATIVE_AI_API_KEY' },
  { id: 'mistral', label: 'Mistral', envVar: 'MISTRAL_API_KEY' },
] as const;

export interface IAIProviderKeyStore {
  listStatuses(): Promise<AIProviderKeyStatus[]>;
  getKey(provider: AIProviderId): Promise<string | null>;
  setKey(provider: AIProviderId, apiKey: string): Promise<void>;
  deleteKey(provider: AIProviderId): Promise<void>;
}
