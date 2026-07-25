import { Context, Effect } from 'effect';
import { describe, expect, it } from 'vitest';
import {
  adapterLayer,
  effectifyPort,
} from '../../../helpers/adapterLayer';

interface ExamplePort {
  readonly label: string;
  load(id: string): Promise<string>;
  fail(): Promise<never>;
}

describe('adapterLayer', () => {
  it('lifts async methods while retaining data properties', async () => {
    const adapter: ExamplePort = {
      label: 'example',
      load: async (id) => `loaded:${id}`,
      fail: async () => {
        throw new Error('broken');
      },
    };
    const service = effectifyPort(adapter);

    expect(service.label).toBe('example');
    await expect(Effect.runPromise(service.load('1'))).resolves.toBe('loaded:1');
    await expect(Effect.runPromise(service.fail())).rejects.toThrow('broken');
  });

  it('provides the lifted service through a Layer tag', async () => {
    const Example = Context.GenericTag<ReturnType<typeof effectifyPort<ExamplePort>>>(
      'test/ExamplePort',
    );
    const layer = adapterLayer(Example, {
      label: 'example',
      load: async (id: string) => `loaded:${id}`,
      fail: async () => Promise.reject(new Error('broken')),
    });

    await expect(
      Effect.runPromise(
        Example.pipe(Effect.flatMap((service) => service.load('2')), Effect.provide(layer)),
      ),
    ).resolves.toBe('loaded:2');
  });
});
