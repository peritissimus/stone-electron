import { Cause, Effect, Exit } from 'effect';
import { describe, expect, it } from 'vitest';
import { domainOperation } from '../../../../src/main/application/usecases/domainOperation';
import { NoteEntity, NoteValidationError } from '../../../../src/main/domain';

describe('domainOperation', () => {
  it('exposes validation failures as tagged expected errors', () => {
    const program = domainOperation(() => NoteEntity.create({ id: '' })).pipe(
      Effect.catchTag('NoteValidationError', (error) => Effect.succeed(error)),
    );
    expect(Effect.runSync(program)).toBeInstanceOf(NoteValidationError);
  });

  it('keeps unexpected programming errors as defects', () => {
    const bug = new TypeError('unexpected programming error');
    const exit = Effect.runSyncExit(
      domainOperation(() => {
        throw bug;
      }).pipe(Effect.catchAll(() => Effect.succeed('should not recover'))),
    );
    expect(Exit.isFailure(exit) && Cause.isDieType(exit.cause)).toBe(true);
    if (Exit.isFailure(exit)) expect(Cause.squash(exit.cause)).toBe(bug);
  });
});
