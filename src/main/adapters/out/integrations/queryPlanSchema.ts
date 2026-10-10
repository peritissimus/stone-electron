import { jsonSchema } from 'ai';
import { Either, JSONSchema, Schema } from 'effect';
import type { QueryPlan } from '../../../domain';

const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/;
const calendarDate = Schema.String.pipe(
  Schema.pattern(isoDatePattern),
  Schema.filter(
    (value) => {
      const date = new Date(`${value}T00:00:00Z`);
      return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
    },
    { message: () => 'Expected a real calendar date', jsonSchema: { format: 'date' } },
  ),
);

const queryPlanSchema = Schema.Struct({
  searchQuery: Schema.NonEmptyTrimmedString,
  dateStart: Schema.NullOr(calendarDate),
  dateEnd: Schema.NullOr(calendarDate),
});

const decode = Schema.decodeUnknownEither(queryPlanSchema, { onExcessProperty: 'error' });

/** One contract provides the model's JSON Schema and runtime validation. */
export const queryPlanOutputSchema = jsonSchema<QueryPlan>(JSONSchema.make(queryPlanSchema), {
  validate: (value) => {
    try {
      return { success: true, value: decodeQueryPlan(value) };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error : new Error(String(error)) };
    }
  },
});

export function decodeQueryPlan(value: unknown): QueryPlan {
  const result = decode(value);
  if (Either.isLeft(result)) throw result.left;
  const plan = result.right;
  if (plan.dateStart === null && plan.dateEnd !== null) {
    throw new Error('dateEnd requires dateStart');
  }
  return { ...plan, dateEnd: plan.dateEnd ?? plan.dateStart };
}
