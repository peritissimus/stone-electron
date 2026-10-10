import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { ManagedRuntime, TestClock, TestContext } from 'effect';
import { generateText, type LanguageModel } from 'ai';
import { AISDKTextGenerator } from '../../../../../src/main/adapters/out/integrations/AISDKTextGenerator';
import type { IAppConfigRepository } from '../../../../../src/main/domain';
import { DEFAULT_APP_CONFIG } from '../../../../../src/main/domain/value-objects/AppConfig';

vi.mock('ai', async (importOriginal) => ({
  ...(await importOriginal<typeof import('ai')>()),
  generateText: vi.fn(),
}));

const runtime = ManagedRuntime.make(TestContext.TestContext);
afterEach(() => vi.clearAllMocks());
afterAll(() => runtime.dispose());

function generator() {
  return new AISDKTextGenerator({
    appConfigRepository: {
      get: async () => ({
        ...DEFAULT_APP_CONFIG,
        ai: {
          ...DEFAULT_APP_CONFIG.ai,
          privacy: {
            allowCloudInference: true,
            allowSendingNoteContent: true,
            allowSendingMetadata: false,
          },
        },
      }),
    } as IAppConfigRepository,
    modelFactory: () => ({}) as LanguageModel,
    runPromise: (effect, options) => runtime.runPromise(effect, options),
  });
}

describe('AI generation cancellation', () => {
  it('requests schema-backed plans through the SDK structured output API', async () => {
    const plan = { searchQuery: 'standup', dateStart: '2026-06-15', dateEnd: '2026-06-15' };
    vi.mocked(generateText).mockResolvedValue({ output: plan } as never);
    expect(
      await generator().planQuery({ query: 'standup yesterday', today: '2026-06-16' }),
    ).toEqual(plan);
    const request = vi.mocked(generateText).mock.calls[0][0];
    expect(request.maxRetries).toBe(0);
    await expect(request.output?.responseFormat).resolves.toEqual(
      expect.objectContaining({
        type: 'json',
        schema: expect.objectContaining({ required: ['searchQuery', 'dateStart', 'dateEnd'] }),
      }),
    );
  });

  it('aborts the SDK request and does not return a late result', async () => {
    let started!: (signal: AbortSignal) => void;
    const invoked = new Promise<AbortSignal>((resolve) => {
      started = resolve;
    });
    vi.mocked(generateText).mockImplementation((request) => {
      started(request.abortSignal!);
      return new Promise(() => {});
    });
    const controller = new AbortController();
    const pending = generator().generateMarkdown({ prompt: 'summary', signal: controller.signal });
    const rejection = expect(pending).rejects.toBeDefined();
    const providerSignal = await invoked;
    controller.abort();
    await rejection;
    expect(providerSignal.aborted).toBe(true);
    expect(generateText).toHaveBeenCalledTimes(1);
  });

  it('cancels retry backoff so an interrupted job cannot issue another paid request', async () => {
    let attempted!: () => void;
    const attempt = new Promise<void>((resolve) => {
      attempted = resolve;
    });
    vi.mocked(generateText).mockImplementation(async () => {
      attempted();
      throw Object.assign(new Error('provider unavailable'), { statusCode: 503 });
    });
    const controller = new AbortController();
    const pending = generator().generateMarkdown({ prompt: 'summary', signal: controller.signal });
    const rejection = expect(pending).rejects.toBeDefined();
    await attempt;
    // Flush the failed attempt into the retry schedule before cancelling it.
    await new Promise((resolve) => setImmediate(resolve));
    controller.abort();
    await rejection;
    await runtime.runPromise(TestClock.adjust(10_000));
    expect(generateText).toHaveBeenCalledTimes(1);
  });

  it('does not start a request when its signal is already aborted', async () => {
    const controller = new AbortController();
    controller.abort(new Error('stopped'));
    await expect(
      generator().generateMarkdown({ prompt: 'summary', signal: controller.signal }),
    ).rejects.toThrow('stopped');
    expect(generateText).not.toHaveBeenCalled();
  });
});
