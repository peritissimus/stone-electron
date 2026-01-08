/**
 * NotebookId Value Object
 *
 * Represents a unique identifier for a Notebook.
 *
 * PURE DOMAIN - No external dependencies.
 */

export class NotebookId {
  private readonly _value: string;

  private constructor(value: string) {
    if (!value || value.trim().length === 0) {
      throw new Error('NotebookId cannot be empty');
    }
    this._value = value.trim();
  }

  static fromString(value: string): NotebookId {
    return new NotebookId(value);
  }

  get value(): string {
    return this._value;
  }

  equals(other: NotebookId): boolean {
    if (!other) return false;
    return this._value === other._value;
  }

  toString(): string {
    return this._value;
  }
}
