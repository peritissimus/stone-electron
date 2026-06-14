import { describe, expect, it, vi } from 'vitest';
import type { LanguageModel } from 'ai';
import {
  type GenerateTextFn,
  AISDKTextGenerator,
} from '../../../../../src/main/adapters/out/integrations/AISDKTextGenerator';
import type { IAIProviderKeyStore, IAppConfigRepository } from '../../../../../src/main/domain';
import {
  DEFAULT_APP_CONFIG,
  type AppConfig,
} from '../../../../../src/main/domain/value-objects/AppConfig';

function createConfig(aiOverrides: Partial<AppConfig['ai']> = {}): AppConfig {
  return {
    ...DEFAULT_APP_CONFIG,
    ai: {
      ...DEFAULT_APP_CONFIG.ai,
      ...aiOverrides,
      indexing: {
        ...DEFAULT_APP_CONFIG.ai.indexing,
        ...aiOverrides.indexing,
      },
      models: {
        ...DEFAULT_APP_CONFIG.ai.models,
        ...aiOverrides.models,
      },
      privacy: {
        ...DEFAULT_APP_CONFIG.ai.privacy,
        ...aiOverrides.privacy,
      },
    },
  };
}

function createAppConfigRepository(config: AppConfig): IAppConfigRepository {
  return {
    get: vi.fn(async () => config),
    set: vi.fn(),
    update: vi.fn(),
  } as unknown as IAppConfigRepository;
}

function createGenerator(config: AppConfig, generateTextFn: GenerateTextFn) {
  const fakeModel = {} as LanguageModel;
  const modelFactory = vi.fn(() => fakeModel);
  const generator = new AISDKTextGenerator({
    appConfigRepository: createAppConfigRepository(config),
    generateTextFn,
    modelFactory,
  });

  return { generator, modelFactory };
}

const source = {
  chunkId: 'chunk-1',
  noteId: 'note-1',
  title: 'Sensitive Roadmap',
  headingPath: ['Decisions', 'Q2'],
  excerpt: 'Launch plan says the LLM feature should cite notes and avoid uncited claims.',
};

describe('AISDKTextGenerator', () => {
  it('blocks cloud generation when privacy settings do not allow note content sharing', async () => {
    const generateTextFn = vi.fn(async (_request: Parameters<GenerateTextFn>[0]) => ({
      text: 'unused',
    }));
    const { generator } = createGenerator(DEFAULT_APP_CONFIG, generateTextFn);

    await expect(
      generator.generateAnswer({
        query: 'What should the LLM feature do?',
        sources: [source],
      }),
    ).rejects.toThrow('Cloud AI inference is disabled');

    expect(generateTextFn).not.toHaveBeenCalled();
  });

  it('sends cited note excerpts without metadata when metadata sharing is disabled', async () => {
    const generateTextFn = vi.fn(async (_request: Parameters<GenerateTextFn>[0]) => ({
      text: 'It should cite notes [1].',
      usage: { inputTokens: 42, outputTokens: 8 },
    }));
    const { generator, modelFactory } = createGenerator(
      createConfig({
        privacy: {
          allowCloudInference: true,
          allowSendingNoteContent: true,
          allowSendingMetadata: false,
        },
      }),
      generateTextFn,
    );

    const result = await generator.generateAnswer({
      query: 'What should the LLM feature do?',
      sources: [source],
    });

    const request = generateTextFn.mock.calls[0][0];
    expect(modelFactory).toHaveBeenCalledWith('openai/gpt-5.4-mini');
    expect(request.system).toContain('using only the provided note excerpts');
    expect(request.system).toContain('Cite sources inline');
    expect(request.prompt).toContain('Question: What should the LLM feature do?');
    expect(request.prompt).toContain('[1]');
    expect(request.prompt).toContain(source.excerpt);
    expect(request.prompt).not.toContain('Title: Sensitive Roadmap');
    expect(request.prompt).not.toContain('Heading: Decisions > Q2');
    expect(result).toEqual({
      text: 'It should cite notes [1].',
      usedSources: [source],
      usage: { inputTokens: 42, outputTokens: 8 },
    });
  });

  it('includes note metadata only when the user explicitly allows metadata sharing', async () => {
    const generateTextFn = vi.fn(async (_request: Parameters<GenerateTextFn>[0]) => ({
      text: 'The roadmap requires cited answers [1].',
    }));
    const { generator } = createGenerator(
      createConfig({
        privacy: {
          allowCloudInference: true,
          allowSendingNoteContent: true,
          allowSendingMetadata: true,
        },
      }),
      generateTextFn,
    );

    await generator.generateAnswer({
      query: 'What is required?',
      sources: [source],
    });

    const request = generateTextFn.mock.calls[0][0];
    expect(request.prompt).toContain('Title: Sensitive Roadmap');
    expect(request.prompt).toContain('Heading: Decisions > Q2');
    expect(request.prompt).toContain('Excerpt:');
  });

  it('returns a useful empty-context answer without calling the provider', async () => {
    const generateTextFn = vi.fn(async (_request: Parameters<GenerateTextFn>[0]) => ({
      text: 'unused',
    }));
    const { generator } = createGenerator(
      createConfig({
        privacy: {
          allowCloudInference: true,
          allowSendingNoteContent: true,
          allowSendingMetadata: true,
        },
      }),
      generateTextFn,
    );

    await expect(
      generator.generateAnswer({
        query: 'What is missing?',
        sources: [],
      }),
    ).resolves.toEqual({
      text: 'I could not find relevant notes to answer that.',
      usedSources: [],
    });
    expect(generateTextFn).not.toHaveBeenCalled();
  });

  // Egress contract: OpenAI may use a user-configured baseURL (sourced
  // only from config.json, never from note content), and all OTHER
  // providers must remain locked to their official endpoints.
  it('passes the configured OpenAI base URL to the provider factory', async () => {
    const generateTextFn = vi.fn(async () => ({ text: 'ok' }));
    const openaiFactory = vi.fn(() => () => ({}) as LanguageModel);
    const config = createConfig({
      models: { ...DEFAULT_APP_CONFIG.ai.models, openaiBaseUrl: 'https://proxy.local/v1' },
      privacy: {
        allowCloudInference: true,
        allowSendingNoteContent: true,
        allowSendingMetadata: false,
      },
    });
    const generator = new AISDKTextGenerator({
      appConfigRepository: createAppConfigRepository(config),
      aiProviderKeyStore: {
        getKey: vi.fn(async () => 'sk-test'),
        setKey: vi.fn(),
        deleteKey: vi.fn(),
        listStatuses: vi.fn(async () => []),
      } as unknown as IAIProviderKeyStore,
      generateTextFn,
      openaiFactory,
    });

    await generator.generateMarkdown({ prompt: 'hi' });

    expect(openaiFactory).toHaveBeenCalledWith({
      apiKey: 'sk-test',
      baseURL: 'https://proxy.local/v1',
    });
  });

  it('omits baseURL when no OpenAI override is configured', async () => {
    const generateTextFn = vi.fn(async () => ({ text: 'ok' }));
    const openaiFactory = vi.fn(() => () => ({}) as LanguageModel);
    const config = createConfig({
      models: { ...DEFAULT_APP_CONFIG.ai.models, openaiBaseUrl: '' },
      privacy: {
        allowCloudInference: true,
        allowSendingNoteContent: true,
        allowSendingMetadata: false,
      },
    });
    const generator = new AISDKTextGenerator({
      appConfigRepository: createAppConfigRepository(config),
      aiProviderKeyStore: {
        getKey: vi.fn(async () => 'sk-test'),
        setKey: vi.fn(),
        deleteKey: vi.fn(),
        listStatuses: vi.fn(async () => []),
      } as unknown as IAIProviderKeyStore,
      generateTextFn,
      openaiFactory,
    });

    await generator.generateMarkdown({ prompt: 'hi' });

    expect(openaiFactory).toHaveBeenCalledWith({ apiKey: 'sk-test' });
    expect(openaiFactory).not.toHaveBeenCalledWith(
      expect.objectContaining({ baseURL: expect.anything() }),
    );
  });

  // Source-scan regression: only OpenAI may take a baseURL, the other
  // providers stay apiKey-only, and no custom fetch is ever injected.
  it('locks egress for non-OpenAI providers (apiKey only, no custom fetch)', async () => {
    const fs = await import('node:fs/promises');
    const path = await import('node:path');
    const source = await fs.readFile(
      path.join(process.cwd(), 'src/main/adapters/out/integrations/AISDKTextGenerator.ts'),
      'utf-8',
    );
    expect(source).toMatch(/createGoogleGenerativeAI\(\{ apiKey \}\)/);
    expect(source).toMatch(/createGroq\(\{ apiKey \}\)/);
    // A custom fetch could redirect content regardless of baseURL — never allow it.
    expect(source).not.toMatch(/fetch\s*:\s*\w/);
  });
});
