/**
 * NoteId Value Object
 *
 * Represents a unique identifier for a Note.
 * Value objects are immutable and compared by value.
 *
 * PURE DOMAIN - No external dependencies.
 * ID generation happens at application/infrastructure layer.
 */

export class NoteId {
  private readonly _value: string;

  private constructor(value: string) {
    if (!value || value.trim().length === 0) {
      throw new Error('NoteId cannot be empty');
    }
    this._value = value.trim();
  }

  /**
   * Create from existing string ID (e.g., from persistence)
   */
  static fromString(value: string): NoteId {
    return new NoteId(value);
  }

  get value(): string {
    return this._value;
  }

  equals(other: NoteId): boolean {
    if (!other) return false;
    return this._value === other._value;
  }

  toString(): string {
    return this._value;
  }
}
