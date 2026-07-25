/**
 * Small migration facade over Effect Schema.
 *
 * It intentionally preserves the former schema-builder call shape while all
 * schemas and decoding are now backed by `effect/Schema`. Keeping the call
 * shape makes the wire-schema migration atomic across main and renderer.
 */

import { Schema } from 'effect';

type OutputOf<T> = T extends CompatSchema<infer A> ? A : never;
type OptionalKeys<Shape extends Record<string, CompatSchema<any>>> = {
  [Key in keyof Shape]: undefined extends OutputOf<Shape[Key]> ? Key : never;
}[keyof Shape];
type RequiredKeys<Shape extends Record<string, CompatSchema<any>>> = Exclude<
  keyof Shape,
  OptionalKeys<Shape>
>;
type ObjectOutput<Shape extends Record<string, CompatSchema<any>>> = {
  [Key in RequiredKeys<Shape>]: OutputOf<Shape[Key]>;
} & {
  [Key in OptionalKeys<Shape>]?: Exclude<OutputOf<Shape[Key]>, undefined>;
};

function parseFailure(error: unknown): Error {
  const failure = new Error(String(error));
  failure.name = 'SchemaParseError';
  return failure;
}

export class CompatSchema<A = unknown> {
  constructor(
    readonly effectSchema: Schema.Schema<any, any, any>,
    readonly optionalValue = false,
    readonly defaultValue?: () => unknown,
  ) {}

  parse(input: unknown): A {
    try {
      return Schema.decodeUnknownSync(
        this.effectSchema as Schema.Schema<any, any, never>,
        {
        onExcessProperty: 'ignore',
        },
      )(input) as A;
    } catch (error) {
      throw parseFailure(error);
    }
  }

  safeParse(input: unknown):
    | { success: true; data: A }
    | { success: false; error: Error } {
    try {
      return { success: true, data: this.parse(input) };
    } catch (error) {
      return { success: false, error: error as Error };
    }
  }

  optional(): CompatSchema<A | undefined> {
    return new CompatSchema(this.effectSchema, true, this.defaultValue);
  }

  nullable(): CompatSchema<A | null> {
    return new CompatSchema(Schema.NullOr(this.effectSchema), this.optionalValue, this.defaultValue);
  }

  default(value: Exclude<A, undefined>): CompatSchema<Exclude<A, undefined>> {
    return new CompatSchema(this.effectSchema, true, () => value) as CompatSchema<
      Exclude<A, undefined>
    >;
  }

  transform<B>(decode: (value: A) => B): CompatSchema<B> {
    return new CompatSchema(
      Schema.transform(this.effectSchema, Schema.Any, {
        strict: false,
        decode,
        encode: (value) => value,
      }),
      this.optionalValue,
      this.defaultValue,
    );
  }

  refine(
    predicate: (value: A) => boolean,
    message?: string | { message?: string },
  ): CompatSchema<A> {
    const detail = typeof message === 'string' ? message : message?.message;
    return new CompatSchema(
      this.effectSchema.pipe(
        Schema.filter((value: A) => predicate(value) || detail || 'refinement failed'),
      ),
      this.optionalValue,
      this.defaultValue,
    );
  }

  min(limit: number): CompatSchema<A> {
    return this.refine((value) =>
      typeof value === 'number'
        ? value >= limit
        : typeof value === 'string' || Array.isArray(value)
          ? value.length >= limit
          : false,
    );
  }

  max(limit: number): CompatSchema<A> {
    return this.refine((value) =>
      typeof value === 'number'
        ? value <= limit
        : typeof value === 'string' || Array.isArray(value)
          ? value.length <= limit
          : false,
    );
  }

  int(): CompatSchema<A> {
    return this.refine((value) => typeof value === 'number' && Number.isInteger(value));
  }

  positive(): CompatSchema<A> {
    return this.refine((value) => typeof value === 'number' && value > 0);
  }

  nonnegative(): CompatSchema<A> {
    return this.refine((value) => typeof value === 'number' && value >= 0);
  }

  strict(): this {
    return this;
  }

  passthrough(): this {
    return this;
  }

  or<B>(other: CompatSchema<B>): CompatSchema<A | B> {
    return new CompatSchema(Schema.Union(this.effectSchema, other.effectSchema));
  }

  nullish(): CompatSchema<A | null | undefined> {
    return this.nullable().optional();
  }

  /**
   * Convert optional/default metadata into an Effect Struct property.
   *
   * zod's `.optional()` admits an explicitly-undefined value, not only a
   * missing key — renderer callers spread partial payloads that way — so the
   * property must not use `exact` optionality.
   */
  toProperty(): any {
    if (!this.optionalValue) return this.effectSchema;
    return this.defaultValue
      ? Schema.optionalWith(this.effectSchema, { default: this.defaultValue })
      : Schema.optional(this.effectSchema);
  }
}

class CompatObjectSchema<
  Shape extends Record<string, CompatSchema<any>>,
  A = ObjectOutput<Shape>,
> extends CompatSchema<A> {
  constructor(readonly shape: Shape) {
    super(
      Schema.Struct(
        Object.fromEntries(
          Object.entries(shape).map(([key, schema]) => [key, schema.toProperty()]),
        ) as any,
      ),
    );
  }

  extend<Extra extends Record<string, CompatSchema<any>>>(
    extra: Extra,
  ): CompatObjectSchema<Shape & Extra> {
    return new CompatObjectSchema({ ...this.shape, ...extra });
  }
}

export function z(): never {
  throw new Error('schema builder is not callable');
}

// Function/namespace merging provides both runtime builders (`z.object`) and
// type helpers (`z.infer`) under the single `z` export call sites expect.
// eslint-disable-next-line no-redeclare
export namespace z {
  export type infer<T> = T extends CompatSchema<infer A> ? A : never;
  export type ZodType<A = unknown> = CompatSchema<A>;
  export type ZodTypeAny = CompatSchema<any>;

  export const string = () => new CompatSchema<string>(Schema.String);
  export const number = () => new CompatSchema<number>(Schema.Number);
  export const boolean = () => new CompatSchema<boolean>(Schema.Boolean);
  export const unknown = () => new CompatSchema<unknown>(Schema.Unknown);
  export const date = () => new CompatSchema<Date>(Schema.DateFromSelf);
  export const voidSchema = () => new CompatSchema<void>(Schema.Void);

  export const object = <Shape extends Record<string, CompatSchema<any>>>(shape: Shape) =>
    new CompatObjectSchema(shape);

  export const array = <A>(item: CompatSchema<A>) =>
    new CompatSchema<A[]>(Schema.Array(item.effectSchema) as any);

  export const literalEnum: <const Values extends readonly [string, ...string[]]>(
    values: Values,
  ) => CompatSchema<Values[number]> = (values) =>
    new CompatSchema(Schema.Literal(...values));

  export const union = <Members extends readonly CompatSchema<any>[]>(members: Members) =>
    new CompatSchema<OutputOf<Members[number]>>(
      Schema.Union(...members.map((member) => member.effectSchema)),
    );

  export const record = <A>(value: CompatSchema<A>) =>
    new CompatSchema<Record<string, A>>(
      Schema.Record({ key: Schema.String, value: value.effectSchema }),
    );

  export const lazy = <A>(thunk: () => CompatSchema<A>) =>
    new CompatSchema<A>(Schema.suspend(() => thunk().effectSchema));
}
