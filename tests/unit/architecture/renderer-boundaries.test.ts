import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

interface ImportEdge {
  file: string;
  importPath: string;
  target: string | null;
}

interface Violation {
  file: string;
  importPath: string;
  reason: string;
}

const repoRoot = path.resolve(__dirname, '../../..');
const rendererRoot = path.join(repoRoot, 'src/renderer');
const sharedRoot = path.join(repoRoot, 'src/shared');

function toPosix(filePath: string): string {
  return path.relative(repoRoot, filePath).split(path.sep).join('/');
}

function walk(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(entryPath);
    return /\.(ts|tsx)$/.test(entryPath) && !/\.(test|spec)\.(ts|tsx)$/.test(entryPath)
      ? [entryPath]
      : [];
  });
}

function collectImports(source: string): string[] {
  const staticImports = source.matchAll(
    /(?:import|export)\s+(?:type\s+)?(?:[^'"]*?\s+from\s*)?['"]([^'"]+)['"]/g,
  );
  const dynamicImports = source.matchAll(/\bimport\(\s*['"]([^'"]+)['"]\s*\)/g);
  return [...staticImports, ...dynamicImports].map((match) => match[1]);
}

function resolveImport(sourceFile: string, importPath: string): string | null {
  if (importPath.startsWith('.'))
    return toPosix(path.resolve(path.dirname(sourceFile), importPath));
  if (importPath === '@renderer' || importPath.startsWith('@renderer/')) {
    return toPosix(path.join(rendererRoot, importPath.slice('@renderer'.length)));
  }
  if (importPath === '@shared' || importPath.startsWith('@shared/')) {
    return toPosix(path.join(sharedRoot, importPath.slice('@shared'.length)));
  }
  return null;
}

function importsFor(file: string): ImportEdge[] {
  return collectImports(fs.readFileSync(file, 'utf8')).map((importPath) => ({
    file: toPosix(file),
    importPath,
    target: resolveImport(file, importPath),
  }));
}

function isModel(target: string | null): boolean {
  return target?.includes('/model/') ?? false;
}

function isApi(target: string | null): boolean {
  return target?.startsWith('src/renderer/api') ?? false;
}

describe('renderer architecture boundaries', () => {
  const files = walk(rendererRoot);

  it('has no files in the retired global renderer layers', () => {
    const retired = ['hooks', 'stores', 'pages', 'navigation', 'editor'];
    const violations = files
      .map(toPosix)
      .filter((file) => retired.some((dir) => file.startsWith(`src/renderer/${dir}/`)));
    expect(violations).toEqual([]);
  });

  it('keeps feature views behind hooks and commands', () => {
    const violations: Violation[] = [];
    for (const file of files.filter(
      (candidate) =>
        toPosix(candidate).includes('/features/') && toPosix(candidate).includes('/views/'),
    )) {
      for (const edge of importsFor(file)) {
        if (isModel(edge.target) || isApi(edge.target)) {
          violations.push({
            file: edge.file,
            importPath: edge.importPath,
            reason: 'feature views must use hooks or commands instead of models or API',
          });
        }
        if (
          edge.target?.includes('/features/') &&
          edge.target.includes('/views/') &&
          !edge.target.startsWith(toPosix(path.dirname(file)).split('/views/')[0])
        ) {
          violations.push({
            file: edge.file,
            importPath: edge.importPath,
            reason: 'feature views must not import sibling feature views',
          });
        }
      }
    }
    expect(violations).toEqual([]);
  });

  it('keeps models React-free and independent of UI layers', () => {
    const violations: Violation[] = [];
    for (const file of files.filter((candidate) => toPosix(candidate).includes('/model/'))) {
      for (const edge of importsFor(file)) {
        const forbidden =
          edge.target?.includes('/hooks/') ||
          edge.target?.includes('/views/') ||
          edge.target?.startsWith('src/renderer/workbench/') ||
          edge.target?.startsWith('src/renderer/components/');
        if (forbidden) {
          violations.push({
            file: edge.file,
            importPath: edge.importPath,
            reason: 'models must remain React-free and independent of hooks and UI',
          });
        }
      }
    }
    expect(violations).toEqual([]);
  });

  it('keeps the workbench out of models and IPC APIs', () => {
    const violations: Violation[] = [];
    for (const file of files.filter((candidate) =>
      toPosix(candidate).startsWith('src/renderer/workbench/'),
    )) {
      for (const edge of importsFor(file)) {
        if (isModel(edge.target) || isApi(edge.target)) {
          violations.push({
            file: edge.file,
            importPath: edge.importPath,
            reason:
              'workbench code must consume focused hooks and feature views, not models or API',
          });
        }
      }
    }
    expect(violations).toEqual([]);
  });

  it('keeps API wrappers below renderer state and UI', () => {
    const violations: Violation[] = [];
    for (const file of files.filter((candidate) =>
      toPosix(candidate).startsWith('src/renderer/api/'),
    )) {
      for (const edge of importsFor(file)) {
        if (
          edge.target?.startsWith('src/renderer/features/') ||
          edge.target?.startsWith('src/renderer/workbench/') ||
          edge.target?.startsWith('src/renderer/components/') ||
          edge.target?.includes('/model/') ||
          edge.target?.includes('/hooks/')
        ) {
          violations.push({
            file: edge.file,
            importPath: edge.importPath,
            reason:
              'API wrappers may only depend on IPC helpers, shared contracts, and local API modules',
          });
        }
      }
    }
    expect(violations).toEqual([]);
  });
});
