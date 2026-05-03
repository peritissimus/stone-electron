import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

type Layer =
  | 'domain'
  | 'application'
  | 'adapters'
  | 'infrastructure'
  | 'main-shared'
  | 'root-shared'
  | 'renderer'
  | 'preload'
  | 'other';

interface Violation {
  file: string;
  importPath: string;
  reason: string;
}

const repoRoot = path.resolve(__dirname, '../../..');
const srcRoot = path.join(repoRoot, 'src');
const mainRoot = path.join(srcRoot, 'main');
const scanRoots = [path.join(srcRoot, 'main'), path.join(srcRoot, 'shared')];

function toPosix(filePath: string): string {
  return path.relative(repoRoot, filePath).split(path.sep).join('/');
}

function isSourceFile(filePath: string): boolean {
  return /\.(ts|tsx)$/.test(filePath) && !/\.(test|spec)\.(ts|tsx)$/.test(filePath);
}

function walk(dir: string): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(entryPath);
    return isSourceFile(entryPath) ? [entryPath] : [];
  });
}

function layerOfPath(filePath: string): Layer {
  const normalized = path.normalize(filePath);
  const checks: Array<[Layer, string]> = [
    ['domain', path.join(mainRoot, 'domain')],
    ['application', path.join(mainRoot, 'application')],
    ['adapters', path.join(mainRoot, 'adapters')],
    ['infrastructure', path.join(mainRoot, 'infrastructure')],
    ['main-shared', path.join(mainRoot, 'shared')],
    ['root-shared', path.join(srcRoot, 'shared')],
    ['renderer', path.join(srcRoot, 'renderer')],
    ['preload', path.join(srcRoot, 'preload')],
  ];

  for (const [layer, root] of checks) {
    if (normalized === root || normalized.startsWith(`${root}${path.sep}`)) {
      return layer;
    }
  }
  return 'other';
}

function resolveImport(sourceFile: string, importPath: string): Layer | 'external' {
  if (importPath.startsWith('.')) {
    return layerOfPath(path.resolve(path.dirname(sourceFile), importPath));
  }

  const aliasTargets: Array<[string, string]> = [
    ['@domain', path.join(mainRoot, 'domain')],
    ['@application', path.join(mainRoot, 'application')],
    ['@adapters', path.join(mainRoot, 'adapters')],
    ['@infrastructure', path.join(mainRoot, 'infrastructure')],
    ['@main', mainRoot],
    ['@shared', path.join(srcRoot, 'shared')],
    ['@renderer', path.join(srcRoot, 'renderer')],
    ['@', srcRoot],
  ];

  for (const [alias, target] of aliasTargets) {
    if (importPath === alias || importPath.startsWith(`${alias}/`)) {
      return layerOfPath(path.join(target, importPath.slice(alias.length)));
    }
  }

  return 'external';
}

function collectImports(source: string): string[] {
  const staticImports = source.matchAll(
    /(?:import|export)\s+(?:type\s+)?(?:[^'"]*?\s+from\s*)?['"]([^'"]+)['"]/g,
  );
  const dynamicImports = source.matchAll(/\bimport\(\s*['"]([^'"]+)['"]\s*\)/g);
  return [...staticImports, ...dynamicImports].map((match) => match[1]);
}

function isAllowedRootSharedExternal(importPath: string): boolean {
  return importPath === 'zod';
}

function violationFor(
  sourceLayer: Layer,
  targetLayer: Layer | 'external',
  importPath: string,
): string | null {
  switch (sourceLayer) {
    case 'domain':
      return targetLayer === 'domain' ? null : 'domain must only import domain files';
    case 'application':
      return targetLayer === 'domain' || targetLayer === 'application'
        ? null
        : 'application must only import domain and application files';
    case 'adapters':
      return targetLayer === 'infrastructure' || targetLayer === 'renderer' || targetLayer === 'preload'
        ? 'adapters must not import infrastructure, renderer, or preload'
        : null;
    case 'main-shared':
      return targetLayer === 'external' || targetLayer === 'main-shared' || targetLayer === 'root-shared'
        ? null
        : 'shared must not import application layers';
    case 'root-shared':
      if (targetLayer === 'root-shared') return null;
      if (targetLayer === 'external' && isAllowedRootSharedExternal(importPath)) return null;
      return 'root shared must stay to wire types, constants, schemas, and pure shared helpers';
    default:
      return null;
  }
}

describe('backend architecture boundaries', () => {
  it('keeps dependencies pointing inward', () => {
    const violations: Violation[] = [];

    for (const file of scanRoots.flatMap(walk)) {
      const sourceLayer = layerOfPath(file);
      const source = fs.readFileSync(file, 'utf8');

      for (const importPath of collectImports(source)) {
        const targetLayer = resolveImport(file, importPath);
        const reason = violationFor(sourceLayer, targetLayer, importPath);
        if (reason) {
          violations.push({ file: toPosix(file), importPath, reason });
        }
      }
    }

    expect(violations).toEqual([]);
  });
});
