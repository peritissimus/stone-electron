import { generateText, type LanguageModel } from 'ai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createGroq } from '@ai-sdk/groq';
import { createOpenAI } from '@ai-sdk/openai';
import type {
  AIConfig,
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

/** Factory shape for the OpenAI provider — injectable so the base-URL
 *  behaviour can be tested without hitting the network. */
export type OpenAIFactory = (settings: {
  apiKey?: string;
  baseURL?: string;
}) => (modelId: string) => LanguageModel;

export interface AISDKTextGeneratorDeps {
  appConfigRepository: IAppConfigRepository;
  aiProviderKeyStore?: IAIProviderKeyStore;
  generateTextFn?: GenerateTextFn;
  modelFactory?: (model: string) => LanguageModel;
  /** Override the OpenAI provider factory (tests). Defaults to createOpenAI. */
  openaiFactory?: OpenAIFactory;
}

export class AISDKTextGenerator implements ITextGenerator {
  private readonly generateTextFn: GenerateTextFn;
  private readonly openaiFactory: OpenAIFactory;

  constructor(private readonly deps: AISDKTextGeneratorDeps) {
    this.openaiFactory = deps.openaiFactory ?? (createOpenAI as unknown as OpenAIFactory);
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
      model: await this.createLanguageModel(request.model ?? config.ai.models.textModel, config.ai),
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
      model: await this.createLanguageModel(request.model ?? config.ai.models.textModel, config.ai),
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

  /**
   * Build a LanguageModel pointing at the provider's API.
   *
   * **Egress contract (security-relevant):** the google / groq factories
   * are called with `{ apiKey }` only — no `baseURL`, no custom `fetch`,
   * no proxy override — so a note's body can reach exactly those
   * providers' official URLs and nowhere else, even under
   * prompt-injection from a malicious note.
   *
   * OpenAI is the single exception: it accepts a user-configured
   * `baseURL` (`ai.models.openaiBaseUrl`) so the user can point Stone at
   * an OpenAI-compatible endpoint (Azure gateway, LiteLLM/Ollama proxy,
   * self-hosted). This is safe because the value comes ONLY from the
   * user's own config.json via the Settings UI — it is never derived
   * from request input or note content, so it is not prompt-injectable.
   * No `fetch:` override is ever passed. If you change this, update the
   * egress contract test in
   * tests/unit/adapters/out/integrations/AISDKTextGenerator.test.ts.
   */
  private async createLanguageModel(model: string, ai: AIConfig): Promise<LanguageModel> {
    if (this.deps.modelFactory) {
      return this.deps.modelFactory(model);
    }

    const parsed = providerModelId(model, 'openai');
    if (parsed.provider === 'openai') {
      const apiKey = (await this.deps.aiProviderKeyStore?.getKey('openai')) ?? undefined;
      const baseURL = ai.models.openaiBaseUrl.trim() || undefined;
      return this.openaiFactory({ apiKey, ...(baseURL ? { baseURL } : {}) })(parsed.modelId);
    }
    if (parsed.provider === 'google') {
      const apiKey = (await this.deps.aiProviderKeyStore?.getKey('google')) ?? undefined;
      return createGoogleGenerativeAI({ apiKey })(
        parsed.modelId as Parameters<ReturnType<typeof createGoogleGenerativeAI>>[0],
      );
    }
    if (parsed.provider === 'groq') {
      const apiKey = (await this.deps.aiProviderKeyStore?.getKey('groq')) ?? undefined;
      return createGroq({ apiKey })(
        parsed.modelId as Parameters<ReturnType<typeof createGroq>>[0],
      );
    }

    throw new Error(`Unsupported text generation provider: ${parsed.provider}`);
  }
}
