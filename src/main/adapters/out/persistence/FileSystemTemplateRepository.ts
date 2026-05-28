/**
 * FileSystemTemplateRepository — reads .md template files from
 * `<workspace>/.stone/templates/` and turns them into TemplateRecords.
 *
 * Optional YAML-ish frontmatter (parsed by the existing
 * MarkdownProcessor) drives display name + description. Fallback for
 * untagged files: pretty-cased filename as name, no description.
 *
 * Seeding: idempotent — `seedDefaultsIfEmpty` only writes when the
 * directory is empty (or missing). User edits + deletions are never
 * overwritten on subsequent calls.
 */

import { logger } from '../../../shared/utils';
import type {
  IFileStorage,
  IMarkdownProcessor,
  IPathService,
  ITemplateRepository,
  IWorkspaceRepository,
  TemplateRecord,
} from '../../../domain';

const TEMPLATES_DIR = '.stone/templates';

export interface FileSystemTemplateRepositoryDeps {
  fileStorage: IFileStorage;
  workspaceRepository: IWorkspaceRepository;
  markdownProcessor: IMarkdownProcessor;
  pathService: IPathService;
}

export class FileSystemTemplateRepository implements ITemplateRepository {
  constructor(private readonly deps: FileSystemTemplateRepositoryDeps) {}

  async list(workspaceId: string): Promise<TemplateRecord[]> {
    const dir = await this.resolveDir(workspaceId);
    if (!dir) return [];
    if (!(await this.deps.fileStorage.exists(dir))) return [];

    const entries = await this.deps.fileStorage.listFiles(dir);
    const mdFiles = entries.filter((entry) => !entry.isDirectory && entry.name.endsWith('.md'));

    const records: TemplateRecord[] = [];
    for (const entry of mdFiles) {
      const record = await this.readTemplate(entry.path);
      if (record) records.push(record);
    }
    records.sort((a, b) => a.name.localeCompare(b.name));
    return records;
  }

  async findById(workspaceId: string, id: string): Promise<TemplateRecord | null> {
    const dir = await this.resolveDir(workspaceId);
    if (!dir) return null;
    const filePath = this.deps.pathService.join(dir, `${id}.md`);
    if (!(await this.deps.fileStorage.exists(filePath))) return null;
    return this.readTemplate(filePath);
  }

  async seedDefaultsIfEmpty(
    workspaceId: string,
    defaults: ReadonlyArray<Pick<TemplateRecord, 'id' | 'body'>>,
  ): Promise<number> {
    const dir = await this.resolveDir(workspaceId);
    if (!dir) return 0;

    const existed = await this.deps.fileStorage.exists(dir);
    if (existed) {
      const entries = await this.deps.fileStorage.listFiles(dir);
      const hasUserTemplates = entries.some(
        (entry) => !entry.isDirectory && entry.name.endsWith('.md'),
      );
      if (hasUserTemplates) return 0;
    } else {
      await this.deps.fileStorage.createDirectory(dir);
    }

    let written = 0;
    for (const template of defaults) {
      const filePath = this.deps.pathService.join(dir, `${template.id}.md`);
      try {
        await this.deps.fileStorage.write(filePath, template.body);
        written += 1;
      } catch (error) {
        logger.warn('[FileSystemTemplateRepository] failed to seed template', {
          id: template.id,
          filePath,
          error,
        });
      }
    }
    return written;
  }

  private async resolveDir(workspaceId: string): Promise<string | null> {
    const workspace = await this.deps.workspaceRepository.findById(workspaceId);
    if (!workspace) return null;
    return this.deps.pathService.join(workspace.folderPath, TEMPLATES_DIR);
  }

  private async readTemplate(filePath: string): Promise<TemplateRecord | null> {
    try {
      const raw = await this.deps.fileStorage.read(filePath);
      if (raw === null) return null;
      const parsed = this.deps.markdownProcessor.parseFrontmatter(raw);

      const filename = this.deps.pathService.basename(filePath, '.md');
      const meta = parsed.metadata as { name?: string; description?: string };

      return {
        id: filename,
        name: meta.name?.trim() || prettyCase(filename),
        description: meta.description?.trim() || null,
        body: parsed.content,
      };
    } catch (error) {
      logger.warn('[FileSystemTemplateRepository] failed to read template', { filePath, error });
      return null;
    }
  }
}

function prettyCase(filename: string): string {
  return filename
    .split(/[-_]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}
