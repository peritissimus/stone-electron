/**
 * ID Generator Port (Outbound)
 *
 * Use cases need unique identifiers, but the concrete generation strategy is
 * an adapter concern.
 */
export interface IIdGenerator {
  generate(): string;
}
