import { execFile } from 'node:child_process';
import { Effect } from 'effect';

export interface CommandOutput {
  readonly stdout: string;
  readonly stderr: string;
}

export interface CommandOptions {
  readonly maxBuffer: number;
}

export type CommandRunner = (
  command: string,
  args: readonly string[],
  options: CommandOptions,
) => Effect.Effect<CommandOutput, Error>;

/** Interrupting the Effect kills the child process through async's canceler. */
export const runCommand: CommandRunner = (command, args, options) =>
  Effect.async<CommandOutput, Error>((resume) => {
    const child = execFile(
      command,
      [...args],
      { maxBuffer: options.maxBuffer },
      (error, stdout, stderr) => {
        if (error) {
          resume(Effect.fail(error));
          return;
        }
        resume(Effect.succeed({ stdout, stderr }));
      },
    );
    return Effect.sync(() => {
      if (!child.killed) child.kill();
    });
  });

export function commandTimeout(message: string): Error {
  const error = new Error(message);
  error.name = 'CommandTimeoutError';
  return error;
}
