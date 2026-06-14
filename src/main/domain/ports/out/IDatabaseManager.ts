/**
 * IDatabaseManager — OUT port for the low-level database manager the database
 * use cases consume. Intentionally narrower than the wire response; the use
 * cases enrich this with counts from the repositories. Implemented in
 * infrastructure and adapted into the container.
 */
export interface IDatabaseManager {
  getStatus(): Promise<{ path: string; size: number; isOpen: boolean }>;
  vacuum(): Promise<void>;
  checkIntegrity(): Promise<{ ok: boolean; errors: string[] }>;
}
