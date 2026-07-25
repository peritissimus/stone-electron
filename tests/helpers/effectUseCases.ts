import { Context, Effect, Layer } from 'effect';

type EffectUseCases<T> = T extends (...args: infer Args) => infer Result
  ? (...args: Args) => Effect.Effect<Awaited<Result>, Error>
  : T extends object
    ? { readonly [Key in keyof T]: EffectUseCases<T[Key]> }
    : T;

const asError = (error: unknown): Error =>
  error instanceof Error ? error : new Error(String(error));

/** Test-only bridge for exercising native facades with Promise mocks. */
export function effectifyUseCases<T extends object>(
  facade: T,
): EffectUseCases<T> {
  const cache = new WeakMap<object, object>();
  const lift = (value: unknown): unknown => {
    if (typeof value === 'function') {
      return (...args: unknown[]) =>
        Effect.tryPromise({
          try: () => Promise.resolve(Reflect.apply(value, facade, args)),
          catch: asError,
        });
    }
    if (typeof value !== 'object' || value === null) return value;
    const cached = cache.get(value);
    if (cached) return cached;
    const proxy = new Proxy(value, {
      get(target, property, receiver) {
        const member = Reflect.get(target, property, receiver) as unknown;
        if (typeof member === 'function') {
          return (...args: unknown[]) =>
            Effect.tryPromise({
              try: () => Promise.resolve(Reflect.apply(member, target, args)),
              catch: asError,
            });
        }
        return lift(member);
      },
    });
    cache.set(value, proxy);
    return proxy;
  };
  return lift(facade) as EffectUseCases<T>;
}

export function useCasesLayer<Identifier, Facade extends object>(
  tag: Context.Tag<Identifier, EffectUseCases<Facade>>,
  facade: Facade,
): Layer.Layer<Identifier> {
  return Layer.succeed(tag, effectifyUseCases(facade));
}
