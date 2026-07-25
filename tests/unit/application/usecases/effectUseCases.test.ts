import { Context, Effect } from 'effect';
import { describe, expect, it } from 'vitest';
import {
  effectifyUseCases,
  useCasesLayer,
} from '../../../helpers/effectUseCases';

describe('effectifyUseCases', () => {
  it('lifts nested per-action facade methods into typed effects', async () => {
    const facade = {
      create: {
        execute: async (request: { title: string }) => ({ id: '1', title: request.title }),
      },
      remove: {
        execute: async () => {
          throw new Error('cannot remove');
        },
      },
    };
    const service = effectifyUseCases(facade);

    await expect(
      Effect.runPromise(service.create.execute({ title: 'Effect' })),
    ).resolves.toEqual({ id: '1', title: 'Effect' });
    await expect(Effect.runPromise(service.remove.execute())).rejects.toThrow('cannot remove');
  });

  it('lets application consumers replace a facade with a test layer', async () => {
    const TestUseCases = Context.GenericTag<ReturnType<typeof effectifyUseCases<{
      load: { execute: (id: string) => Promise<string> };
    }>>>('test/UseCases');
    const fakeLayer = useCasesLayer(TestUseCases, {
      load: { execute: async (id: string) => `fake:${id}` },
    });

    await expect(
      Effect.runPromise(
        TestUseCases.pipe(
          Effect.flatMap((service) => service.load.execute('42')),
          Effect.provide(fakeLayer),
        ),
      ),
    ).resolves.toBe('fake:42');
  });
});
