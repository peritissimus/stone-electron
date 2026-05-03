/**
 * Path Service Port (Outbound)
 *
 * Keeps use cases independent from Node's path module while still allowing
 * adapters to provide platform-correct path behavior.
 */
export interface IPathService {
  readonly separator: string;

  join(...parts: string[]): string;
  basename(filePath: string, suffix?: string): string;
  dirname(filePath: string): string;
  relative(from: string, to: string): string;
  isAbsolute(filePath: string): boolean;
  resolve(filePath: string): string;
  extname(filePath: string): string;
}
