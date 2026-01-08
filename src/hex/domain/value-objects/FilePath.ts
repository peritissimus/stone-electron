/**
 * FilePath Value Object
 *
 * Represents a file system path with validation.
 *
 * PURE DOMAIN - No external dependencies.
 * Path operations happen at infrastructure layer.
 */

export class FilePath {
  private readonly _value: string;

  private constructor(value: string) {
    if (!value || value.trim().length === 0) {
      throw new Error('FilePath cannot be empty');
    }
    this._value = value.trim();
  }

  static fromString(value: string): FilePath {
    return new FilePath(value);
  }

  get value(): string {
    return this._value;
  }

  equals(other: FilePath): boolean {
    if (!other) return false;
    return this._value === other._value;
  }

  toString(): string {
    return this._value;
  }
}
