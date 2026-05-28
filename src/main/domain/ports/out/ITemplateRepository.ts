/**
 * ITemplateRepository — read-only access to the templates folder
 * (`<workspace>/.stone/templates/*.md`).
 *
 * Templates are user-editable markdown files; we never write to this
 * folder from the app today. Seeding the starter pack is a separate
 * concern handled at workspace activation by the seed adapter.
 */

export interface TemplateRecord {
  id: string;
  name: string;
  description: string | null;
  body: string;
}

export interface ITemplateRepository {
  list(workspaceId: string): Promise<TemplateRecord[]>;
  findById(workspaceId: string, id: string): Promise<TemplateRecord | null>;
  /**
   * Idempotent: if the templates folder is missing or empty, copy the
   * defaults in. Returns the number of templates written.
   */
  seedDefaultsIfEmpty(
    workspaceId: string,
    defaults: ReadonlyArray<Pick<TemplateRecord, 'id' | 'body'>>,
  ): Promise<number>;
}
