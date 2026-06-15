import { generateText, type LanguageModel } from 'ai';
import { createAzure } from '@ai-sdk/azure';
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
  PlanQueryRequest,
  QueryPlan,
} from '../../../domain';
import { assertCloudNoteContentAllowed } from '../../../domain';

/**
 * Split a "provider/model" id into its parts (e.g. "openai/gpt-5.4-mini" →
 * { provider: 'openai', modelId: 'gpt-5.4-mini' }). A bare model name falls
 * back to the given provider. Adapter concern — used only here.
 */
export function providerModelId(
  model: string,
  fallbackProvider: string,
): { provider: string; modelId: string } {
  const slashIndex = model.indexOf('/');
  if (slashIndex <= 0) {
    return { provider: fallbackProvider, modelId: model };
  }
  return { provider: model.slice(0, slashIndex), modelId: model.slice(slashIndex + 1) };
}

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
      system: this.systemPrompt(request.today),
      prompt: this.userPrompt(request, config.ai.privacy.allowSendingMetadata),
      temperature: 0.2,
    });

    return {
      text: result.text,
      usedSources: request.sources,
      usage: result.usage,
    };
  }

  async planQuery(request: PlanQueryRequest): Promise<QueryPlan> {
    // Planning sends only the user's question (never note content) to the
    // model, so it isn't gated by allowCloudNoteContent. Any failure (no key,
    // cloud disabled, bad JSON) degrades to a literal, date-less plan so Ask
    // still works.
    const fallback: QueryPlan = { searchQuery: request.query, dateStart: null, dateEnd: null };
    try {
      const config = await this.deps.appConfigRepository.get();
      const result = await this.generateTextFn({
        model: await this.createLanguageModel(
          request.model ?? config.ai.models.textModel,
          config.ai,
        ),
        system: this.planSystemPrompt(),
        prompt: `TODAY is ${request.today}.\nQuestion: ${request.query}\nJSON:`,
        temperature: 0,
      });
      return this.parseQueryPlan(result.text, request.query);
    } catch {
      return fallback;
    }
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

  private systemPrompt(today?: string): string {
    return [
      'You answer questions using only the provided note excerpts.',
      ...(today
        ? [
            `Today's date is ${today}. Resolve relative dates ("yesterday", "the 13th", "last week") against it.`,
          ]
        : []),
      'Some sources carry a Date — use it to answer time-based questions accurately.',
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
    // A bare date is metadata, so it's gated the same way title/heading are.
    const dateLine = includeMetadata && source.date ? `\nDate: ${source.date}` : '';
    if (!includeMetadata) {
      return `[${index}]\n${source.excerpt}`;
    }

    const heading = source.headingPath?.length ? `\nHeading: ${source.headingPath.join(' > ')}` : '';
    return `[${index}]\nTitle: ${source.title}${dateLine}${heading}\nExcerpt:\n${source.excerpt}`;
  }

  private planSystemPrompt(): string {
    return [
      "You convert a user's question about their personal notes into a JSON retrieval plan.",
      'Resolve every time reference relative to TODAY into absolute calendar dates (YYYY-MM-DD):',
      '- "today" = TODAY; "yesterday" = TODAY-1; "day before yesterday" = TODAY-2;',
      '- "the 13th" = the 13th of the current month, or the most recent past 13th if that is in the future;',
      '- "last week" = Monday–Sunday of the previous week; a weekday name = the most recent past such day.',
      'Output ONLY minified JSON with exactly these keys:',
      '  searchQuery: string — concise keywords for full-text/semantic search, with date words removed;',
      '  dateStart: string|null — YYYY-MM-DD, or null if the question has no time reference;',
      '  dateEnd: string|null — YYYY-MM-DD; equal to dateStart for a single day, null when not date-scoped.',
      'No prose, no code fences — JSON only.',
    ].join('\n');
  }

  private parseQueryPlan(text: string, originalQuery: string): QueryPlan {
    try {
      const start = text.indexOf('{');
      const end = text.lastIndexOf('}');
      if (start === -1 || end <= start) {
        return { searchQuery: originalQuery, dateStart: null, dateEnd: null };
      }
      const obj = JSON.parse(text.slice(start, end + 1)) as Record<string, unknown>;

      const searchQuery =
        typeof obj.searchQuery === 'string' && obj.searchQuery.trim()
          ? obj.searchQuery.trim()
          : originalQuery;
      const isIso = (v: unknown): v is string =>
        typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
      const dateStart = isIso(obj.dateStart) ? obj.dateStart : null;
      const dateEnd = dateStart ? (isIso(obj.dateEnd) ? obj.dateEnd : dateStart) : null;

      return { searchQuery, dateStart, dateEnd };
    } catch {
      return { searchQuery: originalQuery, dateStart: null, dateEnd: null };
    }
  }

  /**
   * Build a LanguageModel pointing at the provider's API.
   *
   * **Egress contract (security-relevant):** the azure / google / groq
   * factories are called with `{ apiKey }` only — no `baseURL`, no custom
   * `fetch`, no proxy override — so a note's body can reach exactly those
   * providers' endpoints and nowhere else, even under prompt-injection
   * from a malicious note. (Azure's resource comes from the
   * AZURE_RESOURCE_NAME env var, never from request input.)
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
    if (parsed.provider === 'azure') {
      // Azure OpenAI: deployment id is the modelId (azure/<deployment>). The
      // resource is taken from the AZURE_RESOURCE_NAME env var (SDK default),
      // so egress stays apiKey-only here — no request-derived baseURL.
      const apiKey = (await this.deps.aiProviderKeyStore?.getKey('azure')) ?? undefined;
      return createAzure({ apiKey })(
        parsed.modelId as Parameters<ReturnType<typeof createAzure>>[0],
      );
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
