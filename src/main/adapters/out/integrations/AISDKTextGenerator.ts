import { generateText, type LanguageModel } from 'ai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createCohere } from '@ai-sdk/cohere';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createMistral } from '@ai-sdk/mistral';
import { createOpenAI } from '@ai-sdk/openai';
import type {
  CitationSource,
  GenerateAnswerRequest,
  GenerateAnswerResponse,
  GenerateMarkdownRequest,
  GenerateMarkdownResponse,
  IAIProviderKeyStore,
  IAppConfigRepository,
  ITextGenerator,
} from '../../../domain';
import { assertCloudNoteContentAllowed, providerModelId } from './aiPrivacy';

export type GenerateTextFn = (request: {
  model: LanguageModel;
  system: string;
  prompt: string;
  temperature?: number;
  maxRetries?: number;
}) => Promise<{
  text: string;
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
  };
}>;

export interface AISDKTextGeneratorDeps {
  appConfigRepository: IAppConfigRepository;
  aiProviderKeyStore?: IAIProviderKeyStore;
  generateTextFn?: GenerateTextFn;
  modelFactory?: (model: string) => LanguageModel;
}

export class AISDKTextGenerator implements ITextGenerator {
  private readonly generateTextFn: GenerateTextFn;

  constructor(private readonly deps: AISDKTextGeneratorDeps) {
    this.generateTextFn =
      deps.generateTextFn ??
      ((request) =>
        generateText({
          model: request.model,
          system: request.system,
          prompt: request.prompt,
          temperature: request.temperature,
          maxRetries: request.maxRetries,
        }));
  }

  async generateAnswer(request: GenerateAnswerRequest): Promise<GenerateAnswerResponse> {
    const config = await this.deps.appConfigRepository.get();
    assertCloudNoteContentAllowed(config.ai);

    if (request.sources.length === 0) {
      return {
        text: 'I could not find relevant notes to answer that.',
        usedSources: [],
      };
    }

    const result = await this.generateTextFn({
      model: await this.createLanguageModel(request.model ?? config.ai.models.textModel),
      system: this.systemPrompt(),
      prompt: this.userPrompt(request, config.ai.privacy.allowSendingMetadata),
      temperature: 0.2,
    });

    return {
      text: result.text,
      usedSources: request.sources,
      usage: result.usage,
    };
  }

  async generateMarkdown(request: GenerateMarkdownRequest): Promise<GenerateMarkdownResponse> {
    const config = await this.deps.appConfigRepository.get();
    assertCloudNoteContentAllowed(config.ai);

    const result = await this.generateTextFn({
      model: await this.createLanguageModel(request.model ?? config.ai.models.textModel),
      system: request.system ?? 'You produce concise markdown. Use bullet lists and headings where useful.',
      prompt: request.prompt,
      // Only pass temperature when explicitly requested — reasoning
      // models (o-series, gpt-5+) reject it with a warning otherwise.
      ...(request.temperature !== undefined ? { temperature: request.temperature } : {}),
    });

    return { text: result.text, usage: result.usage };
  }

  private systemPrompt(): string {
    return [
      'You answer questions using only the provided note excerpts.',
      'If the excerpts do not contain enough information, say that clearly.',
      'Cite sources inline using their source numbers, for example [1] or [2].',
      'Do not invent citations or facts that are not present in the excerpts.',
    ].join('\n');
  }

  private userPrompt(request: GenerateAnswerRequest, includeMetadata: boolean): string {
    const sources = request.sources
      .map((source, index) => this.formatSource(source, index + 1, includeMetadata))
      .join('\n\n');

    return `Question: ${request.query}\n\nSources:\n${sources}`;
  }

  private formatSource(source: CitationSource, index: number, includeMetadata: boolean): string {
    if (!includeMetadata) {
      return `[${index}]\n${source.excerpt}`;
    }

    const heading = source.headingPath?.length ? `\nHeading: ${source.headingPath.join(' > ')}` : '';
    return `[${index}]\nTitle: ${source.title}${heading}\nExcerpt:\n${source.excerpt}`;
  }

  private async createLanguageModel(model: string): Promise<LanguageModel> {
    if (this.deps.modelFactory) {
      return this.deps.modelFactory(model);
    }

    const parsed = providerModelId(model, 'openai');
    if (parsed.provider === 'cohere') {
      const apiKey = (await this.deps.aiProviderKeyStore?.getKey('cohere')) ?? undefined;
      return createCohere({ apiKey })(parsed.modelId as Parameters<ReturnType<typeof createCohere>>[0]);
    }
    if (parsed.provider === 'openai') {
      const apiKey = (await this.deps.aiProviderKeyStore?.getKey('openai')) ?? undefined;
      return createOpenAI({ apiKey })(parsed.modelId as Parameters<ReturnType<typeof createOpenAI>>[0]);
    }
    if (parsed.provider === 'anthropic') {
      const apiKey = (await this.deps.aiProviderKeyStore?.getKey('anthropic')) ?? undefined;
      return createAnthropic({ apiKey })(
        parsed.modelId as Parameters<ReturnType<typeof createAnthropic>>[0],
      );
    }
    if (parsed.provider === 'google') {
      const apiKey = (await this.deps.aiProviderKeyStore?.getKey('google')) ?? undefined;
      return createGoogleGenerativeAI({ apiKey })(
        parsed.modelId as Parameters<ReturnType<typeof createGoogleGenerativeAI>>[0],
      );
    }
    if (parsed.provider === 'mistral') {
      const apiKey = (await this.deps.aiProviderKeyStore?.getKey('mistral')) ?? undefined;
      return createMistral({ apiKey })(
        parsed.modelId as Parameters<ReturnType<typeof createMistral>>[0],
      );
    }

    throw new Error(`Unsupported text generation provider: ${parsed.provider}`);
  }
}
