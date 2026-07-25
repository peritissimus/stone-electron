import { Context, Effect, Layer } from 'effect';

type EffectMethod<T> = T extends (...args: infer Args) => infer Result
  ? (...args: Args) => Effect.Effect<Awaited<Result>, Error>
  : T;

type EffectPort<T> = {
  readonly [Key in keyof T]: EffectMethod<T[Key]>;
};

const asError = (error: unknown): Error =>
  error instanceof Error ? error : new Error(String(error));

export function effectifyPort<T extends object>(adapter: T): EffectPort<T> {
  return new Proxy(adapter, {
    get(target, property, receiver) {
      const value = Reflect.get(target, property, receiver) as unknown;
      if (typeof value !== 'function') return value;
      return (...args: unknown[]) =>
        Effect.tryPromise({
          try: () => Promise.resolve(Reflect.apply(value, target, args)),
          catch: asError,
        });
    },
  }) as EffectPort<T>;
}

export function adapterLayer<Identifier, Service>(
  tag: Context.Tag<Identifier, Service>,
  adapter: object,
): Layer.Layer<Identifier> {
  return Layer.succeed(tag, effectifyPort(adapter) as Service);
}
